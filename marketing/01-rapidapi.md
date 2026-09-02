# RapidAPI listing

**Name:** RenderKit — HTML to PDF & Screenshot API
**Category:** Tools / Data
**Short description (max 100):** Render any URL or HTML to PDF or PNG/JPEG/WebP screenshots with real headless Chrome.

**Long description:**
RenderKit turns a URL or your own HTML into a pixel-perfect PDF or screenshot with one HTTP request, rendered by headless Chromium (the same engine as Google Chrome). Built for invoices, reports, certificates, receipts, link previews, social cards and page monitoring.

PDF: paper size (A0–A6, Letter, Legal, Tabloid), margins, landscape, header/footer templates with page numbers, page ranges, print or screen CSS, CSS page size. Screenshot: viewport, full page, element by selector, clip region, retina scale, PNG/JPEG/WebP, transparent background, dark mode. Both: wait for a selector, delay, inject CSS, hide elements, block ads, locale and timezone.

Privacy: nothing is stored; every render runs in an isolated browser context that is destroyed afterwards. Private-network requests are blocked.

Fast: HTML renders typically finish in 300–900 ms.

**Plans:** Basic (free) 100 renders/month · Pro $9 1,000 · Ultra $29 5,000 · Mega $79 25,000. Hard limit, no overage surprises.

**Endpoints:** POST /pdf, GET /pdf, POST /screenshot, GET /screenshot, GET /usage. Import from OpenAPI: https://YOUR-HOST/openapi.json

**Tags:** pdf, html to pdf, screenshot, website screenshot, headless chrome, puppeteer, invoice, render, image, url to pdf
