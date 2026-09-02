# Product Hunt

**Name:** RenderKit
**Tagline (60):** PDFs and screenshots from any URL or HTML, one request
**Topics:** Developer Tools, APIs, Productivity

**Description:**
Every product eventually needs a PDF: an invoice, a report, a certificate. The library route (wkhtmltopdf, dompdf, a Puppeteer script on a cron box) ends with a broken layout on a customer's invoice at 2am.

RenderKit is headless Chrome behind a plain HTTP API. Send a URL or HTML, get back a PDF or a PNG/JPEG/WebP screenshot. Paper sizes, margins, headers and footers with page numbers, full-page and element screenshots, retina, wait-for-selector, CSS injection, dark mode.

Nothing is stored. Each render runs in a fresh browser context that is thrown away. Free plan: 100 renders a month, no card. Paid from $9.

Docs with copy-paste examples for PHP, Laravel, Node, Python, Ruby and Go. OpenAPI spec. Client libraries on Packagist and npm.

**First comment (maker):**
Hi PH. I built RenderKit after the fourth time I had to fix a PDF pipeline someone had built from a headless browser and duct tape. It's deliberately boring: one process, one Chrome, a queue, quotas, Stripe. The free tools (HTML to PDF, website screenshot) run on the same engine if you want to try it without an account. Ask me anything about rendering edge cases, I have seen most of them.

**Gallery:** screenshots of the landing, docs/php page, dashboard, a rendered invoice PDF, a full-page screenshot result.
