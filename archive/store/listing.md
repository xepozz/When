# Chrome Web Store listing — copy and paste

## Name (45 chars max)
SiteSweep: Accessibility, Links & SEO Audit

## Summary (132 chars max)
Crawl the site you're on: WCAG accessibility (axe-core), broken links and SEO issues in one report. Works behind login. Exports.

## Category
Developer Tools

## Language
English

## Description
SiteSweep audits an entire website from your browser tab. Open any page, click the SiteSweep button, and it crawls the site link by link, rendering every page and checking it for:

ACCESSIBILITY (WCAG 2.x)
• Powered by axe-core, the same open-source engine used by Deque, Microsoft and Google tooling
• Every violation with impact level (critical, serious, moderate, minor), the affected elements and a link to the fix
• Grouped by rule across the whole site, so you fix one problem everywhere at once
• Relevant for the European Accessibility Act (in force since June 2025), ADA/Section 508 and public-sector WCAG requirements

BROKEN LINKS
• Every internal link checked; external links optional
• 404s, 5xx, timeouts and redirect chains, each with the pages that contain the link and its anchor text
• Internal pages are fetched once, so audits are fast and gentle on your server

SEO
• Missing, duplicate, short or long titles and meta descriptions
• Missing or multiple H1 headings, missing viewport, canonical problems, noindex flags
• Images without alt attributes, thin pages

WORKS WHERE OTHER TOOLS CAN'T
SiteSweep runs inside your browser, with your session. Staging environments, intranets, admin areas and member-only pages are audited the same way as public pages. No data leaves your machine: results are stored in your browser only.

FREE PLAN
• Full audit of up to 25 pages per crawl, unlimited crawls
• All accessibility, link and SEO checks, on screen

PRO
• Crawls up to 2,000 pages
• Export client-ready HTML reports (print to PDF), CSV for spreadsheets and JSON for your pipeline
• One subscription, every site you work on

PERMISSIONS
SiteSweep asks for access to the site you audit only when you start an audit, and to all sites only if you tick "check external links". It never reads pages in the background.

Accessibility rules © Deque Systems, axe-core, MPL-2.0.

## Single purpose (for the review form)
Audits the website open in the current tab for accessibility, broken links and SEO issues and shows a report.

## Permission justifications
- storage / unlimitedStorage: save audit results and settings locally.
- scripting: inject the axe-core accessibility engine into the pages being audited.
- activeTab: read the URL of the page the user wants to audit.
- Host permissions (optional, requested at audit start): fetch the site's pages to crawl and check links; inject axe-core.
- Remote code: none. All code is packaged in the extension.

## Data usage disclosures (Privacy tab)
- Collects: website content (the pages of the site the user chooses to audit) — processed locally, not transmitted.
- Does not collect personally identifiable information, health, financial, authentication, personal communications, location, web history, or user activity.
- Certify: not sold to third parties; not used for purposes unrelated to the core functionality; not used for creditworthiness.
- Payments: handled by ExtensionPay (extensionpay.com) via Stripe; the extension only receives the paid/unpaid status.

## Pricing to set on ExtensionPay
- Monthly: $9
- Yearly: $59 (best value)
- Free trial: none (the free plan is the trial)

## Screenshots (1280×800) — in this folder after `node store/screenshots.js`
1. audit-overview.png — summary tiles + accessibility list
2. audit-links.png — broken links with source pages
3. audit-seo.png — SEO issues grouped by rule
4. report.png — exported HTML report
5. popup.png — the start dialog
