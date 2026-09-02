// Produces the Chrome Web Store screenshots (1280x800) from a live audit of a local test site.
// Usage: xvfb-run -a node store/screenshots.js <start-url>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), os = require('os');
const SRC = path.join(__dirname, '..', 'extension');
const OUT = path.join(__dirname, 'screenshots');
const START = process.argv[2] || 'http://127.0.0.1:8123/';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitesweep-shots-'));
  fs.cpSync(SRC, dir, { recursive: true });
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  m.host_permissions = [new URL(START).origin + '/*'];
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m));
  fs.writeFileSync(path.join(dir, 'ExtPay.js'), `function ExtPay(){return{startBackground(){},getUser:async()=>({paid:true,email:null,subscriptionStatus:'active',paidAt:new Date()}),openPaymentPage:async()=>{},openLoginPage:async()=>{},onPaid:{addListener(){}}}}`);
  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'p-')), { headless: false, executablePath: '/opt/pw-browsers/chromium', args: [`--disable-extensions-except=${dir}`, `--load-extension=${dir}`, '--no-sandbox'], viewport: { width: 1280, height: 800 }, colorScheme: 'light' });
  let [sw] = ctx.serviceWorkers(); if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  const page = await ctx.newPage();
  await page.goto(`chrome-extension://${extId}/audit.html?start=${encodeURIComponent(START)}&maxPages=25&checkExternal=0&runA11y=1&runSeo=1`);
  await page.waitForFunction(() => /^Done/.test(document.getElementById('status').textContent), null, { timeout: 180000 });
  await page.evaluate(() => { const d = document.querySelector('#a11yList details'); if (d) d.open = true; });
  await page.screenshot({ path: path.join(OUT, '1-audit-overview.png') });
  await page.click('.tab[data-tab="links"]');
  await page.evaluate(() => { const d = document.querySelector('#linkList details'); if (d) d.open = true; });
  await page.screenshot({ path: path.join(OUT, '2-audit-links.png') });
  await page.click('.tab[data-tab="seo"]');
  await page.evaluate(() => { const d = document.querySelector('#seoList details'); if (d) d.open = true; });
  await page.screenshot({ path: path.join(OUT, '3-audit-seo.png') });
  const html = await page.evaluate(() => SiteSweepReport.toHTML(window.__sitesweepAudit));
  const rep = await ctx.newPage();
  await rep.setContent(html);
  await rep.screenshot({ path: path.join(OUT, '4-report.png') });
  // The popup is 340px wide; show it centered on a neutral canvas for the store's 1280x800 requirement.
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 1280, height: 800 });
  await pop.goto(`chrome-extension://${extId}/popup.html`);
  await pop.waitForTimeout(400);
  await pop.addStyleTag({ content: 'html{background:#e9eef4;height:100%}body{margin:120px auto;border-radius:12px;box-shadow:0 20px 50px -20px rgba(0,0,0,.4);overflow:hidden}' });
  // In automation the active tab is the popup page itself, so fill in what a user sees with a site open.
  await pop.evaluate((u) => { document.getElementById('origin').textContent = new URL(u).origin; document.getElementById('originHint').textContent = 'Crawl starts at the current page and follows links on this host.'; document.getElementById('start').disabled = false; }, START);
  await pop.screenshot({ path: path.join(OUT, '5-popup.png') });
  await ctx.close();
  console.log('screenshots in', OUT, fs.readdirSync(OUT));
})().catch((e) => { console.error(e); process.exit(1); });
