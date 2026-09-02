# Community posts

Rule: lead with the free tool and real findings, never with the price list. Communities ban ads and reward useful scripts.

## Telegram (Yii RU chats) — RU

Сделал read-only скрипт, который за минуту показывает, насколько легаси PHP-проект далёк от PHP 8.4: фреймворк и версия, ограничение php в composer, удалённые функции (mysql_*, each, create_function, ereg…), implicit nullable, `${var}`, abandoned-пакеты, возраст composer.lock, есть ли тесты, и итоговый risk score.

```
curl -s https://raw.githubusercontent.com/xepozz/When/main/tools/scan.php | php -- /path/to/app
```

Ничего никуда не отправляет, просто печатает отчёт. Если пришлёте вывод — скажу, что реально предстоит при апгрейде (бесплатно, мне интересна статистика по живым Yii 1.1 / Yii 2 проектам).

Исходник: https://github.com/xepozz/When/blob/main/tools/scan.php

## Yii forum ("Developers for hire") — EN

**Title:** Free 60-second legacy scan for Yii 1.1 / Yii 2 apps (+ fixed-price upgrades)

I wrote a read-only script that prints how far a PHP app is from PHP 8.4: framework and version, PHP constraint, removed functions (mysql_*, each(), create_function, ereg…), implicit-nullable params, `${var}` interpolation, abandoned packages, lock-file age, tests present, and a risk score.

```
curl -s https://raw.githubusercontent.com/xepozz/When/main/tools/scan.php | php -- /path/to/app
```

Send me the output and I'll tell you what the upgrade involves — free. If you want it done: 48-hour written audit for $490 (credited), fixed-price upgrade sprint from $2,900. {{SITE_URL}}

{{YOUR_NAME}}, {{CREDENTIAL}}

## LinkedIn — EN

PHP 8.1 stopped getting security fixes in December 2025. Yii 1.1 reaches end of life on December 31, 2026, and Yii 2.0 security fixes end in November 2026. There are still ~76,000 live Yii sites (Wappalyzer), and every host and pentest is now pushing them to PHP 8.

I turned the first hour of every upgrade I do into a free script: run it on the repo, it prints the blockers and a risk score, nothing leaves your machine.

If your team has "that one app nobody wants to touch", run it and send me the output. I'll tell you what it takes — free. Fixed-price audit and upgrade if you want it done. Link in comments.

## r/PHP — EN (only as a "tool I built" post, no prices in the post body)

**Title:** I turned my legacy-upgrade pre-flight into a single-file scan script (Yii/Laravel/Symfony/raw PHP)

Body: what it checks, an anonymized output sample, the GitHub link. Mention the paid service only when someone asks in comments.

## Habr article outline — RU (publish after the first 5–10 scans)

**Заголовок:** Что ломается при переезде Yii 1.1 и старого Yii 2 на PHP 8.4: {{N}} находок из реальных проектов

1. Почему сейчас: EOL PHP 7.4/8.0/8.1, EOL Yii 1.1 (31.12.2026) и конец security-фиксов Yii 2.0 (23.11.2026), требования хостингов и аудитов.
2. Метод: скрипт, что он ищет и почему именно это.
3. Топ находок по частоте (обезличенно): mysql_*, each(), implicit nullable, dynamic properties, ${var}, abandoned swiftmailer/phpexcel, composer.lock старше 3 лет, 0 тестов.
4. Сколько это стоит по времени: таблица «находка → часы».
5. Порядок работ, который не ломает прод.
6. Ссылка на скрипт; одна строка про аудит/спринт в конце.
