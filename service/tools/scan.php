#!/usr/bin/env php
<?php
/**
 * Legacy PHP scan — 60-second health check of a PHP codebase.
 *
 * Usage:  php scan.php [path]        (default: current directory)
 *         curl -s https://raw.githubusercontent.com/xepozz/When/main/tools/scan.php | php -- /path/to/app
 *
 * Read-only. Sends nothing anywhere. Prints a report you can paste into an email.
 */

declare(strict_types=1);

$root = rtrim($argv[1] ?? getcwd(), '/');
if (!is_dir($root)) {
    fwrite(STDERR, "Not a directory: $root\n");
    exit(1);
}

$skipDirs = ['vendor', 'node_modules', '.git', 'runtime', 'assets', 'cache', 'storage', 'web/assets', 'public/assets', 'protected/runtime'];

// ---------- helpers ----------
function readJson(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    $data = json_decode((string)file_get_contents($file), true);
    return is_array($data) ? $data : null;
}

/** @return \Generator<string> */
function phpFiles(string $root, array $skipDirs): \Generator
{
    $it = new RecursiveIteratorIterator(
        new RecursiveCallbackFilterIterator(
            new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS),
            static function (SplFileInfo $f) use ($root, $skipDirs): bool {
                if ($f->isDir()) {
                    $rel = ltrim(substr($f->getPathname(), strlen($root)), '/');
                    foreach ($skipDirs as $skip) {
                        if ($rel === $skip || str_starts_with($rel, $skip . '/') || basename($rel) === $skip) {
                            return false;
                        }
                    }
                }
                return true;
            }
        )
    );
    foreach ($it as $f) {
        if ($f->isFile() && preg_match('/\.(php|phtml|inc)$/', $f->getFilename())) {
            yield $f->getPathname();
        }
    }
}

// ---------- 1. Framework detection ----------
$composer = readJson("$root/composer.json");
$lock = readJson("$root/composer.lock");
$framework = 'unknown';
$frameworkVersion = null;
$phpConstraint = $composer['require']['php'] ?? null;

$lockPackages = [];
foreach (($lock['packages'] ?? []) as $p) {
    $lockPackages[$p['name']] = $p['version'] ?? '?';
}
$devPackages = [];
foreach (($lock['packages-dev'] ?? []) as $p) {
    $devPackages[$p['name']] = $p['version'] ?? '?';
}

$frameworkMap = [
    'yiisoft/yii2' => 'Yii 2',
    'yiisoft/yii' => 'Yii 1.1',
    'yiisoft/yii-web' => 'Yii 3',
    'laravel/framework' => 'Laravel',
    'symfony/framework-bundle' => 'Symfony',
    'symfony/symfony' => 'Symfony (monolith)',
    'cakephp/cakephp' => 'CakePHP',
    'codeigniter4/framework' => 'CodeIgniter 4',
    'slim/slim' => 'Slim',
    'zendframework/zendframework' => 'Zend Framework',
    'laminas/laminas-mvc' => 'Laminas MVC',
    'phalcon/cphalcon' => 'Phalcon',
];
foreach ($frameworkMap as $pkg => $name) {
    if (isset($lockPackages[$pkg])) {
        $framework = $name;
        $frameworkVersion = $lockPackages[$pkg];
        break;
    }
    if (isset($composer['require'][$pkg])) {
        $framework = $name;
        $frameworkVersion = $composer['require'][$pkg] . ' (constraint, no lock)';
        break;
    }
}

// Yii 1.1 without composer: look for framework/yii.php or protected/ layout
if ($framework === 'unknown') {
    foreach (['framework/YiiBase.php', 'yii/framework/YiiBase.php', '../framework/YiiBase.php', 'vendor/yiisoft/yii/framework/YiiBase.php'] as $cand) {
        $f = "$root/$cand";
        if (is_file($f)) {
            $framework = 'Yii 1.1 (vendored, no composer)';
            if (preg_match("/return '([0-9.]+)';/", (string)file_get_contents($f), $m)) {
                $frameworkVersion = $m[1];
            }
            break;
        }
    }
    if ($framework === 'unknown' && is_dir("$root/protected") && is_file("$root/index.php")) {
        $framework = 'Yii 1.1 (layout detected, framework not found in tree)';
    }
    if ($framework === 'unknown' && is_file("$root/system/core/CodeIgniter.php")) {
        $framework = 'CodeIgniter 3';
    }
    if ($framework === 'unknown' && is_file("$root/wp-config.php")) {
        $framework = 'WordPress';
    }
}

if (is_file("$root/framework/YiiBase.php")) {
    $skipDirs[] = 'framework'; // vendored Yii 1.1 — not the customer's code
}

// ---------- 2. Source scan ----------
$files = 0;
$lines = 0;
$biggest = [];
$deprecated = [
    'mysql_*' => '/\bmysql_(connect|query|fetch_\w+|real_escape_string|select_db|num_rows|close)\s*\(/',
    'ereg/split' => '/\b(ereg|eregi|ereg_replace|split|spliti)\s*\(/',
    'each()' => '/\beach\s*\(/',
    'create_function' => '/\bcreate_function\s*\(/',
    'mcrypt_*' => '/\bmcrypt_\w+\s*\(/',
    '${var} string interpolation' => '/\$\{[a-zA-Z_]\w*\}/',
    'implicit nullable (Type $x = null)' => '/(?<![?\w\\\\])(?:string|int|float|bool|array|\\\\?[A-Z]\w*)\s+\$\w+\s*=\s*null\b/',
    'call-time pass-by-ref (&$)' => '/\w\(\s*&\$/',
    'PHP4 constructors (function ClassName)' => null, // handled separately
    'assert() with string' => '/\bassert\s*\(\s*[\'"]/',
    'utf8_encode/decode' => '/\butf8_(en|de)code\s*\(/',
    'set_magic_quotes / register_globals' => '/\b(set_magic_quotes_runtime|get_magic_quotes_gpc)\s*\(/',
    'strftime/gmstrftime' => '/\b(gm)?strftime\s*\(/',
    'FILTER_SANITIZE_STRING' => '/\bFILTER_SANITIZE_STRING\b/',
    'dynamic properties on stdClass-less classes (heuristic)' => null,
];
$hits = array_fill_keys(array_keys($deprecated), 0);
$closeTagAtEof = 0;
$shortOpenTags = 0;
$evalUses = 0;
$globalUses = 0;
$rawSql = 0;
$phpVersionCalls = 0;
$extUse = [];
$extPatterns = [
    'mysqli' => '/\bmysqli_/', 'PDO' => '/\bnew\s+PDO\b/', 'curl' => '/\bcurl_init\b/', 'gd' => '/\bimagecreate\w*\b/',
    'intl' => '/\b(NumberFormatter|IntlDateFormatter|Collator)\b/', 'soap' => '/\bSoapClient\b/', 'mbstring' => '/\bmb_\w+\(/',
    'openssl' => '/\bopenssl_\w+\(/', 'imagick' => '/\bImagick\b/', 'redis' => '/\bnew\s+Redis\b/', 'memcache(d)' => '/\bnew\s+Memcached?\b/',
];
$tests = 0;

foreach (phpFiles($root, $skipDirs) as $path) {
    $src = (string)file_get_contents($path);
    $files++;
    $n = substr_count($src, "\n") + 1;
    $lines += $n;
    $rel = ltrim(substr($path, strlen($root)), '/');
    $biggest[$rel] = $n;
    if (preg_match('#(^|/)tests?/#i', $rel) || str_ends_with($rel, 'Test.php')) {
        $tests++;
    }
    foreach ($deprecated as $label => $re) {
        if ($re !== null && preg_match_all($re, $src)) {
            $hits[$label] += preg_match_all($re, $src);
        }
    }
    if (preg_match_all('/\bclass\s+(\w+)\b/', $src, $m)) {
        foreach ($m[1] as $cls) {
            if (preg_match('/\bfunction\s+' . preg_quote($cls, '/') . '\s*\(/i', $src)) {
                $hits['PHP4 constructors (function ClassName)']++;
            }
        }
    }
    if (preg_match('/\?>\s*$/', $src)) {
        $closeTagAtEof++;
    }
    if (preg_match('/<\?(?!php|=|xml)/', $src)) {
        $shortOpenTags++;
    }
    $evalUses += preg_match_all('/\beval\s*\(/', $src);
    $globalUses += preg_match_all('/\bglobal\s+\$/', $src);
    $rawSql += preg_match_all('/["\']\s*(SELECT|INSERT|UPDATE|DELETE)\s+.*?\$\w+/i', $src);
    $phpVersionCalls += preg_match_all('/\bversion_compare\s*\(\s*PHP_VERSION\b/', $src);
    foreach ($extPatterns as $ext => $re) {
        if (preg_match($re, $src)) {
            $extUse[$ext] = ($extUse[$ext] ?? 0) + 1;
        }
    }
}
unset($deprecated['dynamic properties on stdClass-less classes (heuristic)'], $hits['dynamic properties on stdClass-less classes (heuristic)']);
arsort($biggest);
$biggest = array_slice($biggest, 0, 5, true);

// ---------- 3. Dependencies ----------
$abandonedKnown = [
    'swiftmailer/swiftmailer' => 'symfony/mailer', 'fzaninotto/faker' => 'fakerphp/faker', 'phpunit/php-token-stream' => null,
    'zendframework/*' => 'laminas/*', 'guzzle/guzzle' => 'guzzlehttp/guzzle', 'phpoffice/phpexcel' => 'phpoffice/phpspreadsheet',
    'bower-asset/*' => 'npm-asset/* or npm', 'yiisoft/yii2-bootstrap' => 'yiisoft/yii2-bootstrap5', 'yiisoft/yii2-swiftmailer' => 'yiisoft/yii2-symfonymailer',
    'yiisoft/yii2-codeception' => 'codeception/module-yii2', 'kartik-v/yii2-widget-*' => '(check maintenance)', 'yiisoft/yii2-jui' => '(no replacement, EOL)',
    'facebook/php-sdk' => 'facebook/graph-sdk', 'phpmailer/phpmailer:<6' => 'phpmailer/phpmailer ^6', 'sebastian/*' => null,
];
$abandonedHits = [];
foreach ($lockPackages + $devPackages as $name => $ver) {
    foreach ($abandonedKnown as $pattern => $repl) {
        $p = explode(':', $pattern)[0];
        if (fnmatch($p, $name) && $repl !== null) {
            $abandonedHits[$name] = "$ver → consider $repl";
        }
    }
    if (isset($lock) && !empty($lock['packages'])) {
        foreach ($lock['packages'] as $pk) {
            if ($pk['name'] === $name && !empty($pk['abandoned'])) {
                $abandonedHits[$name] = "$ver → abandoned" . (is_string($pk['abandoned']) ? ", use {$pk['abandoned']}" : '');
            }
        }
    }
}
$lockAge = null;
if (is_file("$root/composer.lock")) {
    $lockAge = (int)floor((time() - filemtime("$root/composer.lock")) / 86400);
}

// ---------- 4. Infra hints ----------
$infra = [];
foreach (['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'compose.yml', '.github/workflows', '.gitlab-ci.yml', 'Jenkinsfile', '.travis.yml',
    'phpunit.xml', 'phpunit.xml.dist', 'codeception.yml', 'phpstan.neon', 'phpstan.neon.dist', 'psalm.xml', '.php-cs-fixer.php', '.php_cs', 'rector.php', '.env.example', 'Makefile'] as $f) {
    if (file_exists("$root/$f")) {
        $infra[] = $f;
    }
}
$phpIniVersion = null;
foreach (['Dockerfile', '.travis.yml', '.gitlab-ci.yml', 'composer.json'] as $f) {
    if (is_file("$root/$f") && preg_match('/php[:\s-]*([578]\.[0-9])/i', (string)file_get_contents("$root/$f"), $m)) {
        $phpIniVersion = $m[1] . " (from $f)";
        break;
    }
}
$platform = $composer['config']['platform']['php'] ?? null;

// ---------- 5. Score ----------
$risk = 0;
$notes = [];
if ($phpConstraint === null) {
    $risk += 2;
    $notes[] = 'No PHP version constraint in composer.json';
} elseif (preg_match('/\b(5\.|7\.[0-3])/', $phpConstraint)) {
    $risk += 3;
    $notes[] = "PHP constraint targets end-of-life versions ($phpConstraint)";
}
if (str_starts_with($framework, 'Yii 1.1')) {
    $risk += 3;
    $notes[] = 'Yii 1.1 is feature-frozen (end of life 2026-12-31); PHP 8 fixes only in 1.1.25+ (PHP 8.0) and 1.1.28+ (PHP 8.2)';
}
if ($framework === 'Yii 2' && $frameworkVersion && version_compare(ltrim($frameworkVersion, 'v'), '2.0.45', '<')) {
    $risk += 2;
    $notes[] = "Yii 2 $frameworkVersion is older than 2.0.45 (first release with full PHP 8.1 support)";
}
$depTotal = array_sum($hits);
if ($depTotal > 0) {
    $risk += min(3, (int)ceil($depTotal / 25));
    $notes[] = "$depTotal deprecated/removed construct usages found";
}
if ($tests === 0) {
    $risk += 2;
    $notes[] = 'No test files found — upgrade will need a manual regression checklist';
}
if ($lockAge !== null && $lockAge > 365) {
    $risk += 1;
    $notes[] = "composer.lock last touched $lockAge days ago";
}
if ($abandonedHits) {
    $risk += 1;
    $notes[] = count($abandonedHits) . ' abandoned/replaced packages';
}
$risk = min(10, $risk);
$band = $risk >= 7 ? 'HIGH' : ($risk >= 4 ? 'MEDIUM' : 'LOW');

// ---------- 6. Report ----------
$out = [];
$out[] = '== Legacy PHP scan ==';
$out[] = 'Path:                ' . $root;
$out[] = 'Scanned:             ' . date('Y-m-d H:i') . ' with PHP ' . PHP_VERSION;
$out[] = '';
$out[] = 'Framework:           ' . $framework . ($frameworkVersion ? " $frameworkVersion" : '');
$out[] = 'PHP constraint:      ' . ($phpConstraint ?? 'none');
$out[] = 'PHP platform pin:    ' . ($platform ?? 'none') . ($phpIniVersion ? "   CI/Docker hint: $phpIniVersion" : '');
$out[] = 'Source files:        ' . number_format($files) . ' PHP files, ' . number_format($lines) . ' lines';
$out[] = 'Test files:          ' . $tests;
$out[] = 'Dependencies:        ' . count($lockPackages) . ' prod, ' . count($devPackages) . ' dev' . ($lockAge !== null ? " (lock updated $lockAge days ago)" : ' (no composer.lock)');
$out[] = '';
$out[] = 'Deprecated / removed constructs:';
$any = false;
foreach ($hits as $label => $count) {
    if ($count > 0) {
        $any = true;
        $out[] = sprintf('  %-45s %5d', $label, $count);
    }
}
if (!$any) {
    $out[] = '  none detected';
}
$out[] = '';
$out[] = 'Smells:';
$out[] = sprintf('  %-45s %5d', 'eval()', $evalUses);
$out[] = sprintf('  %-45s %5d', 'global $var', $globalUses);
$out[] = sprintf('  %-45s %5d', 'SQL strings with interpolated variables', $rawSql);
$out[] = sprintf('  %-45s %5d', 'files with closing ?> at EOF', $closeTagAtEof);
$out[] = sprintf('  %-45s %5d', 'files with short open tags', $shortOpenTags);
$out[] = sprintf('  %-45s %5d', 'version_compare(PHP_VERSION) branches', $phpVersionCalls);
$out[] = '';
$out[] = 'Extensions in use: ' . ($extUse ? implode(', ', array_keys($extUse)) : 'none detected');
$out[] = 'Infra/tooling:     ' . ($infra ? implode(', ', $infra) : 'none detected');
if ($abandonedHits) {
    $out[] = '';
    $out[] = 'Abandoned / replaced packages:';
    foreach ($abandonedHits as $n => $v) {
        $out[] = "  $n $v";
    }
}
$out[] = '';
$out[] = 'Largest files:';
foreach ($biggest as $f => $n) {
    $out[] = sprintf('  %6d  %s', $n, $f);
}
$out[] = '';
$out[] = "Upgrade risk: $risk/10 ($band)";
foreach ($notes as $n) {
    $out[] = "  - $n";
}
$out[] = '';
$out[] = 'Next step: paste this output into an email to get a free 15-minute read and a fixed quote.';

echo implode("\n", $out), "\n";
