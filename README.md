# SiteSweep — Accessibility, Broken Links & SEO audit for Chrome

A Chrome extension that crawls the site open in the current tab and reports WCAG accessibility violations (axe-core), broken links and redirects, and on-page SEO problems. Runs in the user's browser session, so it audits staging, intranet and logged-in areas that hosted crawlers cannot reach.

**Business model:** freemium via the Chrome Web Store. Free: up to 25 pages per crawl, on screen. Pro ($9/month or $59/year, billed through ExtensionPay/Stripe): up to 2,000 pages and HTML/CSV/JSON report export. The store provides discovery; ExtensionPay handles checkout, subscriptions and license checks. No servers, no support desk required.

**Why this niche:** accessibility audits became a legal requirement for most consumer-facing businesses in the EU on 28 June 2025 (European Accessibility Act), on top of ADA/Section 508 pressure in the US. Agencies and freelancers need cheap, repeatable site-wide audits with a report they can hand to a client. Existing extensions check one page (axe DevTools free tier, WAVE) or are free single-page link checkers; site-wide crawling behind login with exportable reports is the paid gap.

## Repository
| Path | What |
|---|---|
| `extension/` | The extension (Manifest V3, plain JS, no build step). |
| `tests/e2e.js`, `tests/testsite/` | Playwright end-to-end test and the local site with seeded issues. |
| `store/` | Chrome Web Store listing copy, privacy policy, screenshots and the screenshot generator. |
| `build.sh` | Produces the upload zip in `dist/`. |
| `LAUNCH.md` | The one-time steps to put it on sale. |
| `docs/` | GitHub Pages: privacy policy URL for the store listing (and the landing page of the earlier service experiment). |
| `service/` | Earlier experiment: fixed-price legacy PHP upgrade service kit (plan, leads, outreach, scan tool). Kept for reference. |

## How it works
1. The popup reads the active tab's URL and asks for host permission for that origin (all origins only if external link checking is enabled).
2. `audit.html`, an extension page, runs the crawl: pages are fetched with the user's cookies, parsed with `DOMParser` for links and SEO checks, then rendered in a background tab where `axe.min.js` is injected and `axe.run()` collects violations.
3. Links are checked with HEAD (GET fallback), six at a time. Internal pages already fetched are not requested twice.
4. Results are rendered live, stored in `chrome.storage.local`, and exported by `report.js`.

## Run the tests
```
node tests/testsite/server.js &
xvfb-run -a node tests/e2e.js
```

## Third-party code
- [axe-core](https://github.com/dequelabs/axe-core) 4.13.0, MPL-2.0 — `extension/axe.min.js`, `extension/LICENSE-axe-core.txt`
- [ExtPay.js](https://extensionpay.com) 3.1.2, MIT — `extension/ExtPay.js`, `extension/LICENSE-extpay.txt`
