# X / LinkedIn

## X thread
1/ Every product eventually needs a PDF. Then the invoice layout breaks at 2am and you learn wkhtmltopdf died in 2020.
2/ I packaged the fix I kept rebuilding: headless Chrome behind a plain HTTP API. URL or HTML in, PDF or screenshot out. → https://YOUR-HOST
3/ Things you actually need: A4/Letter, margins, page numbers in headers/footers, full-page & element screenshots, retina, wait-for-selector, dark mode.
4/ Nothing stored. Each render is an isolated browser context that is destroyed afterwards. Private networks blocked (SSRF is the real risk in "render this URL").
5/ Free: 100 renders/month, no card. Docs for PHP, Laravel, Node, Python, Ruby, Go. Clients on Packagist and npm.
6/ Code is public and self-hostable. The hosted one is what I sell, from $9/mo.

## LinkedIn
Shipped: RenderKit, an HTML→PDF and screenshot API on real Chrome.
Why: every team I have worked with rebuilt the same headless-browser box for invoices and previews, and every one of them broke the same ways (fonts, page numbers, memory, SSRF).
What: one request in, PDF/PNG/JPEG/WebP out. Free plan 100 renders/month, paid from $9. Self-hostable code on GitHub.
If your product prints invoices, reports or certificates from HTML, this saves the weekend you were going to spend on Puppeteer. Link in comments.
