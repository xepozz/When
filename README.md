# RenderKit — HTML/URL → PDF and screenshot API

Turn any URL or HTML into a PDF or a PNG/JPEG/WebP screenshot with one HTTP request, rendered by headless Chromium. Self-host it from this repo, or use a hosted instance.

```bash
curl -X POST https://YOUR-HOST/v1/pdf \
  -H "Authorization: Bearer rk_live_YOUR_KEY" -H "Content-Type: application/json" \
  -d '{"html":"<h1>Invoice #42</h1>","format":"A4","margin":"12mm"}' -o invoice.pdf
```

**Why:** wkhtmltopdf is unmaintained (QtWebKit from 2012, no flexbox/grid), dompdf/mPDF are not browsers, and a Puppeteer box on a cron leaks memory until it dies. This is one Chromium behind a queue, timeouts, quotas, API keys and Stripe.

## Features
- PDF: A0–A6/Letter/Legal/Tabloid, margins, landscape, header/footer templates with page numbers, page ranges, print or screen CSS, `@page` size
- Screenshot: viewport, full page, element by selector, clip, retina scale, PNG/JPEG/WebP, transparent, dark mode
- Both: wait for selector, delay, inject CSS, hide elements, block ads, locale, timezone, `response=json`
- Accounts, API keys, monthly quotas (failures not charged), per-plan rate limits, Stripe subscriptions with webhooks
- Free tools pages (HTML→PDF, screenshot) and docs for cURL, PHP, Laravel, Node, Python, Ruby, Go
- OpenAPI at `/openapi.json`, `llms.txt`, sitemap, health endpoint
- SSRF guard: DNS-resolved private-range check on the URL and on every sub-request the page makes
- Nothing stored: each render is an isolated browser context, destroyed afterwards

## Deploy in one click
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/xepozz/When)

Also: Fly.io (`fly.toml`), Railway (`app/railway.json`), DigitalOcean (`.do/app.yaml`), or any VPS with Docker Compose + Caddy (`app/DEPLOY.md`). After deploy, set `APP_URL` and the Stripe variables from `app/.env.example`.

## Run locally
```bash
cd app && npm install
CHROMIUM_PATH=/path/to/chromium ALLOW_PRIVATE_NETWORK=1 npm start   # http://localhost:3000
CHROMIUM_PATH=/path/to/chromium npm test                             # 15 integration tests with real Chromium
```

## Clients
- PHP: [`sdk/php`](sdk/php) — `composer require renderkit/renderkit`
- Node: [`sdk/node`](sdk/node) — `npm install renderkit-client`

## Repository
| Path | What |
|---|---|
| `app/` | The service: Fastify 5, SQLite (node:sqlite), Playwright/Chromium, Stripe. `app/README.md`, `app/DEPLOY.md`. |
| `sdk/` | PHP and Node clients with smoke tests. |
| `marketing/` | Final copy for RapidAPI, Product Hunt, Show HN, Reddit, dev.to, directories, social, Habr, Stack Overflow, cold email, and the order to do them in. |
| `LAUNCH.md` | The one-time steps to go live and start selling. |
| `archive/` | Earlier experiments (a Chrome extension for site audits, a service kit). |

## Pricing (hosted)
Free 100 renders/month · Starter $9 for 1,000 · Pro $29 for 5,000 · Business $79 for 25,000. Edit `app/src/config.js` to change.

## License
MIT for the code in this repository. Chromium is bundled via the Playwright Docker image under its own licenses.
