# Launch checklist — SiteSweep on the Chrome Web Store

Everything below the first section is done. The first section is the part only an account holder can do; it takes about 40 minutes once, then the store sells on its own.

## Your part (one time)
1. **ExtensionPay** (payments; 5% fee, Stripe underneath): sign up at https://extensionpay.com, register an extension with the id `sitesweep` (or change `EXTPAY_ID` in `extension/config.js` to the id you pick), connect Stripe, add subscription plans: $9/month and $59/year.
2. **Chrome Web Store developer account**: https://chrome.google.com/webstore/devconsole — one-time $5 fee.
3. Run `./build.sh` → upload `dist/sitesweep-1.0.0.zip`.
4. Fill the listing from `store/listing.md` (name, summary, description, category, single purpose, permission justifications, data disclosures). Upload `store/screenshots/*.png`.
5. Privacy policy URL: enable GitHub Pages for this repo (Settings → Pages → folder `/docs`) and use `https://xepozz.github.io/When/privacy.html`. Put your contact email into `docs/privacy.html` and `store/privacy-policy.md` first.
6. Submit for review. Typical review: 1–3 business days.

## Already done
- Extension built, no build step, no bundler: `extension/`.
- Automated end-to-end test: `xvfb-run -a node tests/e2e.js` (start `node tests/testsite/server.js` first). It loads the extension into Chromium, audits a local site with seeded problems and asserts broken links, redirects, missing alt, unlabeled inputs, missing lang, low contrast, missing/duplicate titles, free-plan cap, Pro exports.
- Store copy, permission justifications, data disclosures, privacy policy: `store/`.
- Screenshots: `store/screenshots/` (regenerate with `xvfb-run -a node store/screenshots.js`).

## After approval (10 minutes a month)
- Reply to store reviews that report bugs; ignore the rest.
- When axe-core releases: `npm view axe-core version`, copy the new `axe.min.js` into `extension/`, bump `version` in `extension/manifest.json`, `./build.sh`, upload.
