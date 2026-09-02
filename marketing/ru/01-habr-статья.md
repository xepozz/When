# Генерация PDF из HTML в 2026: что реально работает (и почему это уже не dompdf)

*Хабы: PHP, Node.js, Разработка веб-сайтов. Теги: pdf, html, chrome, headless, laravel, счета*

Если вы отдавали счета или акты из веб-приложения, вы встречали хотя бы одно из этого: `wkhtmltopdf` (не поддерживается с 2020 года, внутри QtWebKit 2012 года, нет flexbox и grid), `dompdf` или `mPDF` (чистый PHP, для абзаца текста подходит, на реальном CSS разваливается), скрипт на Puppeteer по крону, который течёт по памяти до перезагрузки, или «PDF-сервис» за $99 в месяц, который нельзя оплатить российской картой.

Ниже — что работает, из нескольких лет такой работы в e-commerce и SaaS.

## 1. Рендерить настоящим движком браузера
Единственный рендерер, который понимает ваш CSS так же, как его проверяли дизайнеры, — Chromium. Flexbox, grid, веб-шрифты, `@page`, `break-inside: avoid`. Всё остальное — таблица совместимости, на которую вы будете тратить время.

## 2. Владеть HTML, а не PDF
Счёт — обычный шаблон (Blade, Twig, JSX, Jinja). Print-CSS:

```css
@page { size: A4; margin: 12mm; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; }
thead { display: table-header-group; }   /* шапка таблицы на каждой странице */
.page-break { break-before: page; }
```

Проверка: `Ctrl+P` → «Сохранить как PDF» в Chrome. Если там правильно, из API будет так же.

## 3. Номера страниц — в колонтитулах, а не в теле
Chrome рисует колонтитулы из отдельного шаблона в области полей. Три подводных камня: `font-size` только inline (CSS страницы туда не попадает), поля должны оставлять место, и работают только «магические» классы:

```html
<div style="font-size:9px;width:100%;text-align:center">
  <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>
```

## 4. Не держать браузер рядом с приложением
Chromium берёт 150–300 МБ на рендер и иногда зависает. Ему нужны очередь, жёсткий таймаут и отдельный процесс или сервер. Если это звучит как выходные работы — это те выходные, которые экономит готовый API.

## 5. Целиком на PHP

```php
$html = view('invoices.show', ['invoice' => $invoice])->render();
$pdf = Http::withToken(config('services.renderkit.key'))
    ->post('https://ВАШ-ДОМЕН/v1/pdf', ['html' => $html, 'format' => 'A4', 'margin' => '12mm',
        'footer_template' => '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span>/<span class="totalPages"></span></div>'])
    ->throw()->body();
return response($pdf, 200, ['Content-Type' => 'application/pdf']);
```

и на Node:

```js
const res = await fetch('https://ВАШ-ДОМЕН/v1/pdf', { method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.RENDERKIT_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ html, format: 'A4' }) });
const pdf = Buffer.from(await res.arrayBuffer());
```

## 6. Чеклист перед продом
- Шрифты: абсолютные URL или base64; при позднем подключении `wait_until=networkidle`.
- Картинки: абсолютные URL; `print_background: true` для CSS-фонов.
- Длинные таблицы: `thead { display: table-header-group }`.
- Валюта и даты: форматировать на сервере, не полагаться на локаль браузера (или передавать `locale=ru-RU`).
- Кириллица: Chromium рендерит без танцев, в отличие от dompdf с его подключением шрифтов вручную.

## Как это устроено у меня
Я держу RenderKit (https://ВАШ-ДОМЕН): один Chromium за HTTP API, очередь, таймауты, квоты, оплата российской картой с чеком, серверы в России. Бесплатно 100 рендеров в месяц. Код открыт, можно поднять у себя: https://github.com/xepozz/When
