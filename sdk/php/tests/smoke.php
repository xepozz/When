<?php
// Smoke test against a running server: RENDERKIT_URL=http://localhost:3000 RENDERKIT_KEY=rk_live_... php tests/smoke.php
require __DIR__ . '/../src/Client.php';
require __DIR__ . '/../src/RenderKitException.php';

$rk = new RenderKit\Client(getenv('RENDERKIT_KEY'), getenv('RENDERKIT_URL') ?: 'http://localhost:3000');
$pdf = $rk->pdf(['html' => '<h1>Invoice #42</h1>', 'format' => 'A4']);
assert(str_starts_with($pdf, '%PDF-'), 'pdf magic');
$png = $rk->screenshot(['html' => '<h1>Hi</h1>', 'width' => 400, 'height' => 300]);
assert(substr($png, 1, 3) === 'PNG', 'png magic');
$u = $rk->usage();
assert(isset($u['used'], $u['limit']), 'usage');
try {
    $rk->pdf(['format' => 'A4']);
    throw new LogicException('expected exception');
} catch (RenderKit\RenderKitException $e) {
    assert($e->getStatus() === 400, 'status 400');
}
try {
    (new RenderKit\Client('rk_live_' . str_repeat('0', 48), getenv('RENDERKIT_URL') ?: 'http://localhost:3000'))->usage();
    throw new LogicException('expected exception');
} catch (RenderKit\RenderKitException $e) {
    assert($e->getErrorCode() === 'unauthorized', 'unauthorized');
}
echo "php sdk smoke ok (used {$u['used']}/{$u['limit']})\n";
