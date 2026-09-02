# Launch checklist — from this repo to the first invoice

Only the steps marked **(you)** need a human with accounts and a legal identity. Everything else is already in the repo.

## 0. Facts to confirm before publishing (10 min)
- [ ] **(you)** The landing and the emails say "Yii core team member". Keep it only if it is literally true and public (Yii team page). Otherwise change to the accurate wording in `docs/index.html` (search for `core team`) and `outreach/*`.
- [ ] **(you)** Replace placeholders: `{{YOUR_NAME}}`, `{{YOUR_EMAIL}}`, `{{BOOKING_LINK}}`, `{{PAY_LINK_AUDIT}}` in `docs/index.html` and `outreach/*`. (`grep -rn "{{" docs outreach` shows every spot.)

## 1. Money rail (20 min)
- [ ] **(you)** Stripe → Payment Links → new link: product "Upgrade Audit", $490 one-time, collect email, success URL = landing `#booked`. Paste the URL into `{{PAY_LINK_AUDIT}}`.
- [ ] **(you)** Sprints and care plans are invoiced from Stripe Invoicing after the audit (no link needed).
- [ ] **(you)** RU clients: your usual invoicing route.

## 2. Publish (10 min)
- [ ] **(you)** GitHub → repo Settings → Pages → Source: branch `main` (or this branch), folder `/docs`. URL becomes `https://xepozz.github.io/When/`.
- [ ] **(you)** Optional: custom domain later. Do not wait for it.
- [ ] Raw script URL for the free scan: `https://raw.githubusercontent.com/xepozz/When/<branch>/tools/scan.php` — the landing already uses `main`; adjust if you publish from another branch.

## 3. Day-1 outreach (60 min)
- [ ] **(you)** Post `outreach/community-posts.md` → Telegram (Yii RU chats), Yii forum "Developers for hire".
- [ ] **(you)** Reply to forum threads with `outreach/forum-replies.md` (#1 Softvery is the best lead).
- [ ] **(you)** Send 10 cold emails from `outreach/cold-email.md` to `leads/leads.md` section A and B.
- [ ] **(you)** LinkedIn post (`outreach/community-posts.md`, LinkedIn variant).

## 4. When a scan output arrives
1. Run `php tools/scan.php` yourself on the repo if they give access; otherwise use their pasted output.
2. Fill `delivery/audit-report-template.md` sections 1–3 as the "free 15-minute read" (send only the summary, keep the plan for the paid audit).
3. Send the payment link. Audit clock starts at payment.

## 5. Delivering an audit in 48 h
1. Clone → `php tools/scan.php` → Rector dry-run (`vendor/bin/rector process --dry-run` with `PHP_84` set) → PHPStan level 0 on PHP 8.4 → list of fatal errors on boot.
2. Fill the template completely. Price the sprint: base $2,900 + $400 per 10k lines above 30k + $600 if no tests + $800 for Yii 1.1→PHP 8 framework work. Round to a number ending in 900.
3. Send as PDF + Markdown. Follow up in 3 days with a one-line "any questions on the plan?".

## 6. Weekly
- Re-run the lead searches in `leads/leads.md` section E.
- Publish one article with anonymized findings (Habr + dev.to). Link the free scan.
