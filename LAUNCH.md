# Launch checklist — RenderKit

The product in `app/` is complete and tested. What remains needs accounts in your name.

## One time (about an hour)
1. **Domain + VPS.** Any provider with Docker, 2–4 GB RAM. Point `api.yourdomain.com` at it.
2. **Deploy.** Follow `app/DEPLOY.md` (clone, `.env`, `docker compose up -d`). Check `/health`.
3. **Stripe.** Create the three monthly prices, the webhook, and the customer portal as in `app/DEPLOY.md` step 3. Do one test purchase with a test card.
4. **Search Console.** Add the domain, submit `/sitemap.xml`.
5. **Listings (free, one form each):** RapidAPI (publish the two endpoints with the free plan), Product Hunt (optional), the GitHub "awesome-pdf"/"awesome-screenshot-api" lists via PR.

## What the code does on its own afterwards
- Signups, API keys, quotas, rate limits, Stripe upgrades/downgrades/cancellations via webhooks.
- Free tools pages and docs pages are the inbound funnel (they target the searches people type when they need a PDF/screenshot service).
- Health endpoint for uptime monitoring; SQLite file is the only state to back up.

## Monthly (15 minutes)
- `docker compose pull && docker compose up -d --build` after bumping `playwright-core` and the Dockerfile base tag together (they must match).
- Look at `renders` failures in the dashboard DB for pages that time out; raise `RENDER_TIMEOUT_MS` if needed.

## Honest expectations
Competitors exist (ApiFlash, ScreenshotOne, Urlbox, PDFShift, DocRaptor, Browserless). The market is real and usage-based, which is why solo operators survive in it; the way in is price, reliability and being findable for the exact searches above. Revenue depends on those searches landing, and nobody can promise a timeline.
