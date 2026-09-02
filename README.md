# Legacy PHP Upgrade Sprint — business plan

**Goal:** $5,000/month within 90 days. **Model:** productized service, fixed price, fixed scope, sold by one person with a recognizable name in the Yii/PHP world; delivery is AI-assisted (Claude does the scan, the report draft, and most of the mechanical refactoring; the human signs off and talks to the client).

**Why this and not a SaaS:** a SaaS needs hundreds of paying users and months of marketing before the first $5k month. A service needs 2–4 clients a month and the first check can arrive within 2 weeks, because the buyer already knows they have the problem.

## The problem we sell against

- PHP 7.4 has been end-of-life since Nov 2022, PHP 8.0 since Nov 2023, PHP 8.1 security support ended Dec 2025. Hosts and security audits now force the move.
- Yii 1.1 reaches end of life on 2026-12-31 and Yii 2.0 security fixes end 2026-11-23 (official release cycle). Yii 2 below 2.0.45 has no PHP 8.1 support. Tens of thousands of business apps still run on them (Wappalyzer tracks ~76k live Yii sites; 46% US, 19% RU).
- Job boards show the pain: Yii roles on ZipRecruiter pay $83–131k and lean on "legacy" and "modernization" wording; companies are trying to hire a full-time engineer for what is really a 2–4 week project.

## Offer (three rungs, one ladder)

| Product | Price | Time | What the client gets |
|---|---|---|---|
| **Upgrade Audit** | $490 fixed | 48 h after repo access | Written report: current stack, every blocker for PHP 8.x / current framework, risk map, step-by-step plan, fixed quote for the sprint. Credited 100% toward a sprint. Refund if the plan is not actionable. |
| **Upgrade Sprint** | from $2,900 fixed (quoted in the audit) | 2–3 weeks | Code runs on PHP 8.3/8.4 and current framework release, dependencies replaced or upgraded, deprecations removed, CI added, smoke tests, deploy support, 30 days of fixes. |
| **Care Plan** | $1,500/month | ongoing | Up to 10 h/month for the app after the sprint: framework/security updates, small features, on-call for the legacy pieces left behind. |

Entry is nearly free: a **free 60-second scan** (`tools/scan.php`) the prospect runs on their own machine. Its output is the sales conversation.

### Path to $5k/month
- Month 1: 3 audits ($1,470) + 1 sprint ($2,900) = **$4,370**
- Month 2+: 2 audits + 1 sprint + 1 care plan = **$5,380**
- Steady state: 1 sprint + 2–3 care plans ≈ $5,900–7,400 with less selling

## Who buys
1. Founders/CTOs of SMB SaaS or e-commerce built 2012–2019 on Yii 1.1 / Yii 2 / raw PHP, 1–5 developers, no one who remembers the original codebase.
2. Agencies inheriting a client's legacy app they do not want to touch.
3. Companies currently trying to hire a "Yii developer" (job posts are a public pain signal — see `leads/leads.md`).

## Why the buyer picks us
- The seller is a Yii core team member (state this only where it is verifiably true; see LAUNCH.md).
- Fixed price. Every competitor in the search results quotes hourly or "contact us".
- 48-hour audit with money-back — a low-risk first purchase.
- A public, read-only scan script they can run before talking to anyone.

## Funnel
1. **Reach:** posts in Yii/PHP communities (Yii forum "Job offers"/"Developers for hire", Yii Telegram chats, r/PHP, Habr, LinkedIn), direct outreach to companies with Yii job posts, replies to "need Yii developer" threads.
2. **Hook:** "Run this script on your legacy app, paste me the output, I'll tell you what the upgrade costs. Free."
3. **Convert:** free 15-minute read → $490 audit (Stripe payment link) → sprint quote inside the audit → sprint.
4. **Retain:** care plan offered at sprint hand-off.

## What is in this repo
- `docs/index.html` — landing page (GitHub Pages).
- `tools/scan.php` — the free scan; also the first step of every audit.
- `delivery/audit-report-template.md` — the audit deliverable, so an audit takes hours, not days.
- `leads/leads.md` — verified leads and lead sources.
- `outreach/` — cold email, forum replies, community posts, Upwork proposal (EN + RU).
- `LAUNCH.md` — the exact checklist to go from this repo to the first invoice.

## 14-day plan to the first check
| Day | Action |
|---|---|
| 1 | Create Stripe payment link for the $490 audit; enable GitHub Pages; put real name/email/booking link on the landing. |
| 1 | Post the free scan in Yii Telegram chats and on the Yii forum (`outreach/community-posts.md`). |
| 2 | Send 10 cold emails to companies with open Yii job posts (`leads/leads.md`, `outreach/cold-email.md`). |
| 3 | Reply to the open forum "need Yii developer" threads with the scan offer. |
| 4–7 | Run scans on everything that comes back, give the free 15-minute read, send the audit payment link. |
| 7 | Publish a Habr/dev.to article: "What breaks when you move Yii 1.1 to PHP 8.4: 20 real findings" using anonymized scan outputs. |
| 8–14 | Deliver the first audits within 48 h each; quote sprints inside them. Second cold-email wave (20). |
