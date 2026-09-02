# Stack Overflow (answers, not promotion)

Search weekly: `[wkhtmltopdf] is:question`, `[dompdf] flexbox`, `[puppeteer] pdf page numbers`, `[laravel] pdf invoice`, `html to pdf api`.

Answer pattern: solve the actual problem (print CSS, header template quirk, font loading), show the Chrome-based approach with a code block, and add one line at the end: "If you'd rather not run Chrome yourself, I maintain RenderKit (https://YOUR-HOST), which is this behind an HTTP API; disclosure: my product." SO tolerates that when the answer stands on its own.

Ready answer snippets:
- Page numbers in Puppeteer/Chrome: the `pageNumber`/`totalPages` span classes, inline font-size, margin requirement.
- dompdf ignores flexbox: it does; options are table layout or a Chromium renderer.
- wkhtmltopdf and web fonts: it uses QtWebKit; `font-display`, woff2 unsupported; use woff/ttf or switch engines.
