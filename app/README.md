# RenderKit — HTML/URL → PDF and screenshot API

A hosted rendering API: send a URL or HTML, get back a PDF or a PNG/JPEG/WebP screenshot rendered by headless Chromium. Sold as monthly subscriptions (Stripe). One Node.js process, SQLite, one Chromium, one VPS.

- `POST /v1/pdf`, `POST /v1/screenshot` (also `GET` with query params), `GET /v1/usage`
- Free tools at `/tools/html-to-pdf` and `/tools/screenshot` (no signup; the marketing funnel)
- Docs with copy-paste examples for cURL, PHP, Laravel, Node, Python, Ruby, Go at `/docs`
- Dashboard: signup/login, API keys, usage chart, recent renders, Stripe Checkout and customer portal
- Plans: Free 100/mo · Starter $9 1,000 · Pro $29 5,000 · Business $79 25,000 (edit `src/config.js`)

## Run locally
```
cd app
npm install
CHROMIUM_PATH=/path/to/chromium ALLOW_PRIVATE_NETWORK=1 npm start
# open http://localhost:3000
```
Without `CHROMIUM_PATH` Playwright looks for its own browser install; in Docker the base image provides it.

## Tests
```
CHROMIUM_PATH=/path/to/chromium npm test
```
Integration tests start the real app with an in-memory database and a real Chromium: rendering (PDF/PNG/JPEG/WebP, full page, element, wait_for, dark mode, header/footer), auth, validation, quotas, refunds on failure, per-plan rate limits, SSRF blocking (main URL and sub-resources), signup/login/keys/CSRF, free tools and their IP limits, Stripe webhook signature/idempotency/plan transitions, concurrency.

## Deploy (Docker Compose + Caddy, any VPS)
See `DEPLOY.md`.

## Layout
```
src/server.js        app factory (Fastify 5)
src/routes/api.js    /v1 endpoints, per-plan rate limit, quota
src/routes/billing.js Stripe checkout, portal, webhook
src/routes/dashboard.js signup/login/keys
src/routes/tools.js  free tools
src/routes/pages.js  landing, pricing, docs, sitemap, health
src/render/pool.js   Chromium pool: N isolated contexts, bounded queue, hard timeouts
src/render/render.js option validation + rendering
src/render/ssrf.js   private-network guard (DNS resolved, sub-requests intercepted)
src/auth.js          scrypt passwords, API keys (sha256 at rest), sessions
src/usage.js         monthly quota (atomic), render log
views/index.js       server-rendered pages
```
