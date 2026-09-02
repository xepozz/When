# Generating invoice PDFs from HTML in 2026: what actually works

*(dev.to / Hashnode / Medium. Tags: php, laravel, node, pdf, webdev)*

If you have ever shipped invoices from a web app, you have met at least one of these: `wkhtmltopdf` (unmaintained since 2020, QtWebKit from 2012, no flexbox, no grid), `dompdf` (pure PHP, fine for a paragraph, falls apart on real CSS), a Puppeteer script on a cron box that leaks memory until the box dies, or a "PDF service" with a $99 minimum.

Here is what works, from a few years of doing this for e-commerce and SaaS products.

## 1. Render with a real browser engine
The only renderer that treats your CSS the way your designers tested it is Chromium. Flexbox, grid, web fonts, `@page`, `break-inside: avoid`, all of it. Everything else is a compatibility table you will lose time to.

## 2. Own the HTML, not the PDF
Write the invoice as a normal template (Blade, Twig, JSX, Jinja). Use print CSS:

```css
@page { size: A4; margin: 12mm; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; }
.page-break { break-before: page; }
```

Test it in Chrome with `Ctrl+P` → "Save as PDF". If it looks right there, it will look right from the API.

## 3. Page numbers go in header/footer templates, not in the page
Chrome draws headers and footers in the margin area from a separate template. Rules that bite: set `font-size` inline (page CSS does not apply), leave margins large enough, and use the magic classes:

```html
<div style="font-size:9px;width:100%;text-align:center">
  <span class="pageNumber"></span> / <span class="totalPages"></span>
</div>
```

## 4. Don't run the browser next to your app
Chromium takes 150–300 MB per render and occasionally hangs. Put it behind a queue with a hard timeout, in its own process or box. If that sounds like a weekend of work, that is the weekend a hosted API saves you.

## 5. The whole thing in PHP

```php
$html = view('invoices.show', ['invoice' => $invoice])->render();
$pdf = Http::withToken(config('services.renderkit.key'))
    ->post('https://YOUR-HOST/v1/pdf', ['html' => $html, 'format' => 'A4', 'margin' => '12mm',
        'footer_template' => '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span>/<span class="totalPages"></span></div>'])
    ->throw()->body();
return response($pdf, 200, ['Content-Type' => 'application/pdf']);
```

and in Node:

```js
const res = await fetch('https://YOUR-HOST/v1/pdf', { method: 'POST',
  headers: { Authorization: 'Bearer ' + process.env.RENDERKIT_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ html, format: 'A4' }) });
const pdf = Buffer.from(await res.arrayBuffer());
```

## 6. Checklist before go-live
- Fonts: link with absolute URLs or inline base64; wait for `networkidle` if they load late.
- Images: absolute URLs; `print_background: true` if you use CSS backgrounds.
- Long tables: `thead { display: table-header-group }` repeats headers on each page.
- Currency and dates: render them server-side; do not rely on the browser locale (or pass `locale`).
- Test A4 and Letter; US customers will ask.

I run RenderKit (https://YOUR-HOST), which is this setup as a service with a free plan of 100 renders a month. The self-hostable code is on GitHub if you would rather run it yourself.
