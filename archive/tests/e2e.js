// End-to-end test: load the extension in Chromium, audit the local test site, assert findings.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert');

const SRC = require('path').join(__dirname, '..', 'extension');

function prepareExtension(paid) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitesweep-ext-'));
  fs.cpSync(SRC, dir, { recursive: true });
  // Test-only: pre-granted host permission for the local site (no permission dialog in automation)
  const m = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  m.host_permissions = ['http://127.0.0.1/*'];
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(m, null, 2));
  // Test-only: ExtPay stub with a fixed paid state
  fs.writeFileSync(path.join(dir, 'ExtPay.js'), `function ExtPay(id){ return { startBackground(){}, getUser: async()=>({paid:${paid}, email:null, subscriptionStatus:${paid ? "'active'" : 'null'}, paidAt:${paid ? 'new Date()' : 'null'}}), openPaymentPage: async()=>{}, openLoginPage: async()=>{}, onPaid:{addListener(){}} }; }`);
  return dir;
}

async function launch(extDir) {
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitesweep-profile-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    headless: false,
    executablePath: '/opt/pw-browsers/chromium',
    args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, '--no-sandbox'],
    acceptDownloads: true
  });
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;
  return { ctx, extId };
}

async function runAudit(ctx, extId, extra = {}) {
  const page = await ctx.newPage();
  const q = new URLSearchParams({ start: 'http://127.0.0.1:8123/', maxPages: 25, checkExternal: 0, runA11y: 1, runSeo: 1, ...extra });
  const logs = [];
  page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await page.goto(`chrome-extension://${extId}/audit.html?${q}`);
  await page.waitForFunction(() => /^Done|failed|not granted|Missing/.test(document.getElementById('status').textContent), null, { timeout: 120000 });
  const status = await page.textContent('#status');
  const audit = await page.evaluate(() => window.__sitesweepAudit || null);
  return { page, status, audit, logs };
}

(async () => {
  // ---------- Free plan ----------
  let extDir = prepareExtension(false);
  let { ctx, extId } = await launch(extDir);
  let { page, status, audit, logs } = await runAudit(ctx, extId);
  console.log('status:', status);
  if (!audit) { console.log(logs.join('\n')); throw new Error('no audit result'); }
  const urls = audit.pages.map((p) => p.url);
  console.log('pages:', urls);
  const s = audit.summary;
  console.log('summary:', JSON.stringify(s));

  assert.ok(urls.includes('http://127.0.0.1:8123/about.html'), 'crawled about');
  assert.ok(urls.includes('http://127.0.0.1:8123/products/widget-a.html'), 'crawled depth 2');
  assert.ok(!urls.includes('http://127.0.0.1:8123/brochure.pdf'), 'pdf not crawled as page');
  assert.ok(!urls.some((u) => u.startsWith('https://example.com')), 'external not crawled');
  const missing = audit.pages.find((p) => p.url === 'http://127.0.0.1:8123/missing.html');
  assert.strictEqual(missing.status, 404, 'missing page 404');
  const redirect = audit.links.find((l) => l.url === 'http://127.0.0.1:8123/redirect');
  assert.strictEqual(redirect.kind, 'redirect', 'redirect detected');
  assert.strictEqual(redirect.finalUrl, 'http://127.0.0.1:8123/about.html');
  const broken2 = audit.links.find((l) => l.url === 'http://127.0.0.1:8123/broken-2.html');
  assert.strictEqual(broken2.kind, 'broken', 'broken link');
  assert.ok(broken2.sources.some((x) => x.page === 'http://127.0.0.1:8123/about.html'), 'broken link source page');
  const ext = audit.links.find((l) => l.url === 'https://example.com/external');
  assert.ok(ext && ext.external && !ext.kind, 'external listed but not checked');
  assert.ok(s.links.broken >= 2, 'at least two broken links');

  const rules = new Set();
  for (const p of audit.pages) if (p.a11y) for (const v of p.a11y.violations) rules.add(v.id);
  console.log('a11y rules:', [...rules].join(', '));
  assert.ok(rules.has('image-alt'), 'image-alt violation');
  assert.ok(rules.has('label'), 'label violation');
  assert.ok(rules.has('html-has-lang'), 'html-has-lang violation');
  assert.ok(rules.has('color-contrast'), 'color-contrast violation');
  assert.ok(s.a11yTotal > 0);
  assert.ok(audit.pages.every((p) => !p.a11yError || p.status >= 400), 'no axe errors on ok pages: ' + JSON.stringify(audit.pages.filter((p) => p.a11yError).map((p) => [p.url, p.a11yError])));

  const seo = (url) => audit.pages.find((p) => p.url === url).seo.map((x) => x.rule);
  console.log('seo about:', seo('http://127.0.0.1:8123/about.html'));
  for (const r of ['missing-title', 'missing-description', 'missing-h1', 'missing-viewport']) assert.ok(seo('http://127.0.0.1:8123/about.html').includes(r), r);
  assert.ok(seo('http://127.0.0.1:8123/contact.html').includes('multiple-h1'));
  assert.ok(seo('http://127.0.0.1:8123/contact.html').includes('duplicate-title'));
  assert.ok(seo('http://127.0.0.1:8123/').includes('duplicate-title'));
  assert.ok(seo('http://127.0.0.1:8123/').includes('img-missing-alt'));
  assert.ok(seo('http://127.0.0.1:8123/products/').includes('long-title'));

  // UI: tiles + free gating
  assert.strictEqual(await page.textContent('#tPages'), String(s.pages));
  assert.ok((await page.textContent('#plan')).includes('Free'));
  await page.click('#exportCsv');
  assert.strictEqual(await page.isHidden('#upsell'), false, 'upsell shown on free export');
  await page.click('#upsellClose');
  // free cap: ask for 100, get at most 25
  ({ status, audit } = await runAudit(ctx, extId, { maxPages: 100 }));
  assert.strictEqual(audit.settings.maxPages, 25, 'free cap enforced');
  // last-audit view
  const last = await ctx.newPage();
  await last.goto(`chrome-extension://${extId}/audit.html?view=last`);
  await last.waitForFunction(() => /^Done/.test(document.getElementById('status').textContent), null, { timeout: 10000 });
  assert.strictEqual(await last.textContent('#origin'), 'http://127.0.0.1:8123');
  // popup renders
  const pop = await ctx.newPage();
  await pop.goto(`chrome-extension://${extId}/popup.html`);
  await pop.waitForTimeout(500);
  console.log('popup plan:', await pop.textContent('#plan'), '| origin:', await pop.textContent('#origin'));
  await page.screenshot({ path: '/tmp/audit-free.png', fullPage: true });
  await ctx.close();

  // ---------- Pro plan ----------
  extDir = prepareExtension(true);
  ({ ctx, extId } = await launch(extDir));
  ({ page, status, audit } = await runAudit(ctx, extId, { maxPages: 100 }));
  assert.ok((await page.textContent('#plan')).includes('Pro'));
  assert.strictEqual(audit.settings.maxPages, 100, 'pro cap');
  for (const [id, ext] of [['exportHtml', '.html'], ['exportCsv', '.csv'], ['exportJson', '.json']]) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#' + id)]);
    assert.ok(dl.suggestedFilename().endsWith(ext), 'download ' + ext);
    const p = await dl.path();
    const content = fs.readFileSync(p, 'utf8');
    if (ext === '.csv') assert.ok(content.includes('link-broken') && content.includes('image-alt'), 'csv content');
    if (ext === '.html') { assert.ok(content.includes('Site audit') && content.includes('Images must have alternative text') && content.includes('link-broken') === false && content.includes('broken-2.html'), 'html report content'); fs.copyFileSync(p, '/tmp/report-sample.html'); }
    if (ext === '.json') assert.ok(JSON.parse(content).summary.pages === audit.summary.pages);
  }
  assert.strictEqual(await page.isHidden('#upsell'), true);
  await page.screenshot({ path: '/tmp/audit-pro.png', fullPage: true });
  await ctx.close();
  console.log('\nALL E2E ASSERTIONS PASSED');
})().catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });
