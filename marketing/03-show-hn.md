# Show HN

**Title:** Show HN: RenderKit – HTML/URL to PDF and screenshot API on one Chrome process

**URL:** https://YOUR-HOST

**Text (first comment, post right after submitting):**
I kept rebuilding the same thing at different companies: a headless Chrome box that turns HTML into invoices and takes screenshots for previews, plus the queue, timeouts and quota logic around it. RenderKit is that, packaged.

Stack: Node 22 + Fastify, SQLite (WAL) for accounts and usage, Playwright driving one Chromium with N isolated contexts and a bounded queue, Stripe for subscriptions. One VPS. The code is on GitHub and self-hostable; the hosted version is what I sell.

Things that took longer than the rendering itself:
- SSRF: the main URL is DNS-resolved and checked against private ranges, and every sub-request the page makes is intercepted and checked too, otherwise "render this URL" is a proxy into your network.
- WebP: Chromium's screenshot API only does PNG/JPEG, so WebP goes through a canvas inside the page.
- Quotas that don't charge for failures and are atomic under concurrency (single UPDATE with a WHERE on the count).
- Header/footer templates: Chrome ignores your page CSS there, you must set font-size inline, and margins must leave room or they silently vanish.

Free plan is 100 renders/month. Happy to answer questions about rendering edge cases.
