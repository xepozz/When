# Leads and lead sources

Everything here was checked on 2026-09-02. "Verified" means the page was fetched and the detail read; "listed" means the search result named it but the page could not be opened from this environment (anti-bot). Contact details are only those the party published themselves.

## A. Warm: public "we need a Yii developer" posts

| # | Who | Signal | Contact / where | Pitch |
|---|---|---|---|---|
| 1 | **Softvery Solutions** (auto-parts e-commerce, PHP/Yii2 + jQuery→React, LAMP on VMware, "legacy-to-modern migration") | Verified. Forum job post 2025-07-02, still open. | anna.mishevskaya@softverysolutions.com · https://forum.yiiframework.com/t/138721 | They are hiring a full-time senior for a migration. Offer the audit + sprint as the migration's first milestone, then a care plan instead of a hire. `outreach/forum-replies.md` #1 |
| 2 | **DevTeam.Space** ("PHP Yii 2 Senior Dev", remote, $2,000–3,000/mo) | Verified on Habr Career. | https://career.habr.com/vacancies/1000168308 | Agency-style vendor; they resell developers. Offer white-label sprints for their clients' Yii apps. `outreach/cold-email.md` variant B |
| 3 | **maxivilla** (Yii app, "maintain and expand existing program", Indonesia-only) | Verified. Forum 2025-05-03. | https://forum.yiiframework.com/t/138545 (no email; reply in thread / DM) | Low priority (geo restriction, likely low budget). Reply with the free scan anyway — zero cost. |
| 4 | **amqanadilo** (Yii 1.1 support, $1,000/mo part-time) | Verified. Forum 2024-06-13. | Skype `digital0life` · https://forum.yiiframework.com/t/136269 | Budget too low for a sprint; a Yii 1.1 app on a $1k/mo retainer is exactly the "care plan" shape. Offer scan + $490 audit. |
| 5 | **"Senior Yii developer to AI startup"** | Listed. Forum 2024-10-15, id 136562. | https://forum.yiiframework.com/t/136562 | Open the thread, check if still live, reply with scan. |
| 6 | **Matellio Inc.** (YII Developer, Jaipur) | Listed on LinkedIn. | https://in.linkedin.com/jobs/view/yii-developer-at-matellio-inc-3370497659 | Outsourcing company; white-label sprint pitch. |
| 7 | **DRC Systems** (PHP (Yii) Developer, Gandhinagar) | Listed on LinkedIn. | https://in.linkedin.com/jobs/view/php-yii-developer-at-drc-systems-3772371437 | Same as above. |

## B. Cold: companies known to run Yii in production (Wappalyzer sample, verified 2026-09-02)

Not "in pain" signals, but real Yii users with money. Best approached via LinkedIn to the CTO/Head of Engineering with the free scan. Sorted by likely legacy-ness (older consumer sites first).

| Site | Notes |
|---|---|
| wordcounter.net | High traffic, low tech spend — classic one-dev legacy site |
| pastebin.com | High traffic, very low tech spend |
| font.download | Very high traffic, low spend |
| dns-shop.ru | Large RU retailer, high spend (RU market — see section D) |
| automobile.tn | Medium traffic, Tunisia |
| youcontrol.com.ua | High tech spend, Ukraine |
| myfin.by | Medium traffic, Belarus |
| kachelmannwetter.com | Weather service, DE |
| collaborator.pro | RU-speaking marketing platform |
| hosting.timeweb.ru | Hosting panel on Yii |
| wolverineworldwide.com, printful.com, thetradedesk.com, opswat.com, experiences.klaviyo.com, elementsofai.com, craftcms.com | Yii detected on at least one property; larger companies, longer sales cycle |

Source: https://www.wappalyzer.com/technologies/web-frameworks/yii/ (76,000 live Yii sites tracked; US 46%, RU 19%).

## C. Paid lead lists (when the free channels are exhausted)
- **Wappalyzer** sells the full Yii list with company + contact details: https://www.wappalyzer.com/technologies/web-frameworks/yii/ (their product page states 37,700 entries with contacts).
- **BuiltWith** Yii website list: https://trends.builtwith.com/websitelist/Yii-Framework (page requires a browser; export is paid).
- Filter both by: tech spend "low/very low" + traffic "medium/high" + last detected > 3 years ago = legacy with revenue.

## D. RU/CIS market (your home audience)
- Habr Career search "yii": https://career.habr.com/vacancies?q=yii&type=all — 1 live match today (DevTeam.Space). Re-check weekly.
- hh.ru API (`https://api.hh.ru/vacancies?text=yii`) returned 403 from this environment; run it from your machine with a `User-Agent` header — it lists every current Yii vacancy in RU/CIS with employer names.
- Yii Telegram chats (Yii1/Yii2/Yii3, listed on https://www.yiiframework.com/community) — post the free scan, not the price list.
- Payments from RU clients: use a local invoice route; Stripe is for non-RU clients.

## E. Ongoing lead capture (10 minutes a day)
1. Yii forum: https://forum.yiiframework.com/c/job-offers and https://forum.yiiframework.com/c/developers-for-hire — reply to every new "need a developer" thread within 24 h.
2. LinkedIn Jobs search "Yii" sorted by date: https://www.linkedin.com/jobs/php-yii-jobs-worldwide (86 open roles at time of check). Each posting = one cold email to the hiring manager.
3. Indeed US: https://www.indeed.com/q-PHP-Yii-Framework-Developer-l-United-States-jobs.html
4. ZipRecruiter: https://www.ziprecruiter.com/Jobs/Yii
5. Upwork: search "Yii" + "upgrade"/"PHP 8"; use `outreach/upwork-proposal.md`.
