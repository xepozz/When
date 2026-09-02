# Selling plan — what goes where, in what order

Replace `https://YOUR-HOST` with the deployed URL everywhere. Every text below is final copy, not an outline.

## Day 0 (needs the live URL)
1. Deploy (one button: see root README). Set Stripe. Confirm `/health`, sign up yourself, run one render.
2. Publish the SDKs, distribution channels where developers search:
   - Packagist: `cd sdk/php && composer validate` → submit https://packagist.org/packages/submit with the repo URL (needs a GitHub repo containing `composer.json` at root: push `sdk/php` to a separate repo `renderkit-php`, or set Packagist's subdirectory support via a split). One-time, 5 minutes.
   - npm: `cd sdk/node && npm publish` (needs `npm login`).
3. Search Console: add property, submit `https://YOUR-HOST/sitemap.xml`.

## Day 1 — listings (each is one form, copy from the files here)
- RapidAPI Hub: import `https://YOUR-HOST/openapi.json`, paste `01-rapidapi.md`. Set the same 4 plans. RapidAPI brings buyers who never see your site.
- Product Hunt: `02-producthunt.md`. Launch on a Tuesday–Thursday, 00:01 PT.
- Hacker News: `03-show-hn.md` as "Show HN". Post at 8–9am ET, reply to every comment for 3 hours.
- Directories (free, 5 minutes each): SaaSHub, AlternativeTo (as alternative to wkhtmltopdf, Puppeteer, DocRaptor, Urlbox, ApiFlash, ScreenshotOne), Uneed, BetaList, Indie Hackers product page, DevHunt, Microlaunch, LaunchingNext, There's An AI For That (no: not AI), Public APIs list (github.com/public-apis/public-apis PR: category "Development"), free-for.dev PR, awesome-pdf / awesome-puppeteer alternatives PR — texts in `05-directories.md`.

## Day 2–7 — content that ranks (paste, do not rewrite)
- dev.to + Hashnode + Medium: `04-article-invoice-pdf.md` (canonical → your domain if you also host it at /blog).
- Reddit: `06-reddit.md`, one post per subreddit on different days, no links in the body where the subreddit forbids them.
- X/LinkedIn: `07-social.md`.
- Habr (RU): `08-habr.md`.

## Ongoing (automatic or 10 min/week)
- The free tools and docs pages rank over 2–3 months for "html to pdf api", "screenshot api", "pdf api php/laravel/node/python". Nothing to do.
- Answer Stack Overflow questions tagged `wkhtmltopdf`, `dompdf`, `puppeteer` + "pdf" with a real answer and one link (`09-stackoverflow.md`).
- Cold email to agencies building invoicing/e-commerce systems: `10-cold-email.md`. Only if you want it; not required for the funnel.

## What to expect
Free signups from listings arrive within days. Paid conversions in this category are usage-driven: a developer ships your API in a product, then upgrades when the free 100 renders run out. Expect the first paid plan 2–6 weeks after listings go live, and judge the channel by free signups per week first.
