// Smoke test against a running server: RENDERKIT_URL=http://localhost:3000 RENDERKIT_KEY=rk_live_... node test.js
const assert = require('node:assert/strict');
const { RenderKit, RenderKitError } = require('./index.js');
(async () => {
  const rk = new RenderKit(process.env.RENDERKIT_KEY, { baseUrl: process.env.RENDERKIT_URL || 'http://localhost:3000' });
  const pdf = await rk.pdf({ html: '<h1>Invoice #42</h1>', format: 'A4' });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const png = await rk.screenshot({ html: '<h1>Hi</h1>', width: 400, height: 300 });
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  const u = await rk.usage();
  assert.ok(u.limit > 0);
  await assert.rejects(() => rk.pdf({ format: 'A4' }), (e) => e instanceof RenderKitError && e.status === 400);
  await assert.rejects(() => new RenderKit('rk_live_' + '0'.repeat(48), { baseUrl: rk.baseUrl }).usage(), (e) => e.code === 'unauthorized');
  console.log(`node sdk smoke ok (used ${u.used}/${u.limit})`);
})().catch((e) => { console.error(e); process.exit(1); });
