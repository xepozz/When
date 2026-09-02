'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const Stripe = require('stripe');
const { build } = require('../src/server');
const auth = require('../src/auth');

const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const WEBHOOK_SECRET = 'whsec_test_secret';
let app, key, userId, target;

before(async () => {
  target = http.createServer((req, res) => {
    if (req.url === '/slow') return setTimeout(() => { res.end('<h1>slow</h1>'); }, 3000);
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><html><head><title>Target</title></head><body><h1 id="h">Hello from target</h1><div class="late">late</div></body></html>');
  }).listen(0, '127.0.0.1');
  await new Promise((r) => target.on('listening', r));
  const config = require('../src/config');
  const plans = Object.fromEntries(Object.entries(config.plans).map(([k, p]) => [k, { ...p, ratePerMin: 10000 }])); // per-plan limits are tested in isolation below
  app = build({ logger: process.env.TEST_LOG ? { level: 'error' } : false, dbPath: ':memory:', chromiumPath: CHROMIUM, allowPrivateNetwork: true, renderTimeoutMs: 20000, appUrl: 'http://localhost:3000', plans,
    stripe: { secretKey: '', webhookSecret: WEBHOOK_SECRET, prices: { starter: 'price_starter', pro: 'price_pro', business: 'price_business' } } });
  await app.ready();
  const u = auth.createUser(app.db, 'test@example.com', 'password123');
  key = u.apiKey; userId = u.userId;
});
after(async () => { await app.close(); target.close(); });

const targetUrl = () => `http://127.0.0.1:${target.address().port}/`;
const hdr = () => ({ authorization: 'Bearer ' + key, 'content-type': 'application/json' });

test('rejects missing and bad API keys', async () => {
  let r = await app.inject({ method: 'POST', url: '/v1/pdf', payload: { html: '<p>x</p>' } });
  assert.equal(r.statusCode, 401);
  assert.equal(r.json().error.code, 'unauthorized');
  r = await app.inject({ method: 'POST', url: '/v1/pdf', headers: { authorization: 'Bearer rk_live_' + 'f'.repeat(48) }, payload: { html: '<p>x</p>' } });
  assert.equal(r.statusCode, 401);
});

test('validates parameters', async () => {
  let r = await app.inject({ method: 'POST', url: '/v1/pdf', headers: hdr(), payload: {} });
  assert.equal(r.statusCode, 400);
  assert.match(r.json().error.message, /url.*html/i);
  r = await app.inject({ method: 'POST', url: '/v1/pdf', headers: hdr(), payload: { html: '<p>x</p>', format: 'B5' } });
  assert.equal(r.statusCode, 400);
  r = await app.inject({ method: 'POST', url: '/v1/screenshot', headers: hdr(), payload: { html: '<p>x</p>', width: 9000 } });
  assert.equal(r.statusCode, 400);
});

test('renders a PDF from HTML with header/footer', async () => {
  const r = await app.inject({ method: 'POST', url: '/v1/pdf', headers: hdr(), payload: { html: '<h1>Invoice #42</h1><p>Total $120</p>', format: 'A4', margin: '15mm', footer_template: '<div style="font-size:9px"><span class="pageNumber"></span>/<span class="totalPages"></span></div>' } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.headers['content-type'], 'application/pdf');
  assert.equal(r.rawPayload.subarray(0, 5).toString(), '%PDF-');
  assert.ok(r.rawPayload.length > 1000);
  assert.equal(r.headers['x-renderkit-usage'], '1/100');
  assert.ok(Number(r.headers['x-renderkit-time']) > 0);
});

test('renders a PDF from a URL via GET and json response', async () => {
  const r = await app.inject({ method: 'GET', url: `/v1/pdf?url=${encodeURIComponent(targetUrl())}&api_key=${key}&response=json&landscape=1` });
  assert.equal(r.statusCode, 200, r.body);
  const j = r.json();
  assert.equal(j.content_type, 'application/pdf');
  assert.equal(Buffer.from(j.data, 'base64').subarray(0, 5).toString(), '%PDF-');
});

test('screenshots: png, jpeg, webp, full page, element, wait_for, dark mode', async () => {
  let r = await app.inject({ method: 'POST', url: '/v1/screenshot', headers: hdr(), payload: { url: targetUrl(), width: 640, height: 400 } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.headers['content-type'], 'image/png');
  assert.equal(r.rawPayload.subarray(1, 4).toString(), 'PNG');
  r = await app.inject({ method: 'POST', url: '/v1/screenshot', headers: hdr(), payload: { html: '<div style="height:3000px;background:linear-gradient(red,blue)"></div>', full_page: true, format: 'jpeg', quality: 50 } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.headers['content-type'], 'image/jpeg');
  assert.equal(r.rawPayload[0], 0xff); assert.equal(r.rawPayload[1], 0xd8);
  r = await app.inject({ method: 'POST', url: '/v1/screenshot', headers: hdr(), payload: { url: targetUrl(), selector: '#h', format: 'webp', wait_for: '.late', dark_mode: true, device_scale_factor: 2 } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.headers['content-type'], 'image/webp');
  assert.equal(r.rawPayload.subarray(8, 12).toString(), 'WEBP');
});

test('render failure returns 422 and is not charged', async () => {
  const before = (await app.inject({ method: 'GET', url: '/v1/usage', headers: hdr() })).json().used;
  const r = await app.inject({ method: 'POST', url: '/v1/screenshot', headers: hdr(), payload: { url: targetUrl(), selector: '#does-not-exist', timeout: 1500 } });
  assert.equal(r.statusCode, 422, r.body);
  assert.equal(r.json().error.code, 'render_failed');
  const after = (await app.inject({ method: 'GET', url: '/v1/usage', headers: hdr() })).json().used;
  assert.equal(after, before);
});

test('usage endpoint and quota exhaustion (402)', async () => {
  const u = (await app.inject({ method: 'GET', url: '/v1/usage', headers: hdr() })).json();
  assert.equal(u.plan, 'free'); assert.equal(u.limit, 100); assert.ok(u.used >= 4);
  app.db.prepare('UPDATE usage SET count = 100 WHERE user_id = ?').run(userId);
  const r = await app.inject({ method: 'POST', url: '/v1/pdf', headers: hdr(), payload: { html: '<p>x</p>' } });
  assert.equal(r.statusCode, 402);
  assert.equal(r.json().error.code, 'quota_exceeded');
  app.db.prepare('UPDATE usage SET count = 5 WHERE user_id = ?').run(userId);
});

test('SSRF: private hosts are blocked when not allowed', async () => {
  const strict = build({ logger: false, dbPath: ':memory:', chromiumPath: CHROMIUM, allowPrivateNetwork: false, appUrl: 'http://localhost:3000' });
  await strict.ready();
  try {
    const u = auth.createUser(strict.db, 'ssrf@example.com', 'password123');
    for (const url of ['http://127.0.0.1:8080/', 'http://localhost/', 'http://169.254.169.254/latest/meta-data', 'http://10.0.0.1/', 'http://[::1]/', 'ftp://example.com/']) {
      const r = await strict.inject({ method: 'POST', url: '/v1/pdf', headers: { authorization: 'Bearer ' + u.apiKey, 'content-type': 'application/json' }, payload: { url } });
      assert.ok([400, 422].includes(r.statusCode), url + ' -> ' + r.statusCode);
      assert.match(r.json().error.message, /private|Only http/i, url);
    }
    // sub-resources pointing to private hosts are aborted, the page still renders
    const r = await strict.inject({ method: 'POST', url: '/v1/screenshot', headers: { authorization: 'Bearer ' + u.apiKey, 'content-type': 'application/json' }, payload: { html: `<img src="${targetUrl()}x.png"><p>ok</p>` } });
    assert.equal(r.statusCode, 200, r.body);
  } finally { await strict.close(); }
});

test('rate limit per plan', async () => {
  const limited = build({ logger: false, dbPath: ':memory:', chromiumPath: CHROMIUM, appUrl: 'http://localhost:3000' });
  await limited.ready();
  try {
    const u = auth.createUser(limited.db, 'rl@example.com', 'password123');
    const other = auth.createUser(limited.db, 'rl2@example.com', 'password123');
    let last;
    for (let i = 0; i < 11; i++) last = await limited.inject({ method: 'GET', url: '/v1/usage', headers: { authorization: 'Bearer ' + u.apiKey } });
    assert.equal(last.statusCode, 429);
    assert.equal(last.json().error.code, 'rate_limited');
    const o = await limited.inject({ method: 'GET', url: '/v1/usage', headers: { authorization: 'Bearer ' + other.apiKey } });
    assert.equal(o.statusCode, 200, 'limits are per user, not per IP');
    const anon = await limited.inject({ method: 'GET', url: '/v1/usage' });
    assert.equal(anon.statusCode, 401);
  } finally { await limited.close(); }
});

test('signup, dashboard, key management, logout', async () => {
  let r = await app.inject({ method: 'POST', url: '/signup', payload: { email: 'dash@example.com', password: 'password123' } });
  assert.equal(r.statusCode, 200);
  const m = r.body.match(/rk_live_[0-9a-f]{48}/);
  assert.ok(m, 'key shown once');
  const sid = r.cookies.find((c) => c.name === 'sid').value;
  r = await app.inject({ method: 'GET', url: '/dashboard', cookies: { sid } });
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /Free/);
  assert.doesNotMatch(r.body, /rk_live_[0-9a-f]{48}/, 'full key never shown again');
  r = await app.inject({ method: 'POST', url: '/dashboard/keys', cookies: { sid }, payload: { name: 'prod' } });
  assert.match(r.body, /rk_live_[0-9a-f]{48}/);
  const keyId = app.db.prepare("SELECT id FROM api_keys WHERE name = 'prod'").get().id;
  r = await app.inject({ method: 'POST', url: `/dashboard/keys/${keyId}/revoke`, cookies: { sid } });
  assert.equal(r.statusCode, 303);
  assert.ok(app.db.prepare('SELECT revoked_at FROM api_keys WHERE id = ?').get(keyId).revoked_at);
  r = await app.inject({ method: 'POST', url: '/signup', payload: { email: 'dash@example.com', password: 'password123' } });
  assert.equal(r.statusCode, 400);
  r = await app.inject({ method: 'POST', url: '/login', payload: { email: 'dash@example.com', password: 'wrong' } });
  assert.equal(r.statusCode, 401);
  r = await app.inject({ method: 'POST', url: '/login', payload: { email: 'dash@example.com', password: 'password123' } });
  assert.equal(r.statusCode, 303);
  r = await app.inject({ method: 'POST', url: '/logout', cookies: { sid } });
  assert.equal(r.statusCode, 303);
  r = await app.inject({ method: 'GET', url: '/dashboard', cookies: { sid } });
  assert.equal(r.statusCode, 303);
  r = await app.inject({ method: 'POST', url: '/dashboard/keys', cookies: { sid }, headers: { origin: 'https://evil.example' }, payload: { name: 'x' } });
  assert.equal(r.statusCode, 403);
});

test('public pages render', async () => {
  for (const url of ['/', '/pricing', '/docs', '/docs/php', '/docs/laravel', '/docs/go', '/tools/html-to-pdf', '/tools/screenshot', '/signup', '/login', '/robots.txt', '/sitemap.xml', '/health']) {
    const r = await app.inject({ method: 'GET', url });
    assert.equal(r.statusCode, 200, url);
  }
  assert.equal((await app.inject({ method: 'GET', url: '/docs/cobol' })).statusCode, 404);
  assert.equal((await app.inject({ method: 'GET', url: '/v1/nope', headers: hdr() })).statusCode, 404);
});

test('free tools render and are rate limited per IP', async () => {
  let r = await app.inject({ method: 'POST', url: '/tools/html-to-pdf', payload: { html: '<h1>free</h1>', format: 'A4', margin: '10mm' } });
  assert.equal(r.statusCode, 200, r.body);
  assert.equal(r.headers['content-type'], 'application/pdf');
  r = await app.inject({ method: 'POST', url: '/tools/screenshot', payload: { url: targetUrl(), width: 800, height: 600, format: 'png' } });
  assert.equal(r.statusCode, 200, r.body);
  r = await app.inject({ method: 'POST', url: '/tools/html-to-pdf', payload: { url: 'not a url' } });
  assert.equal(r.statusCode, 400);
  assert.match(r.body, /Invalid URL/);
  for (let i = 0; i < 9; i++) r = await app.inject({ method: 'POST', url: '/tools/html-to-pdf', payload: { url: 'not a url' } });
  assert.equal(r.statusCode, 429);
});

test('stripe webhook: signature, idempotency, plan changes', async () => {
  const send = (event) => {
    const payload = JSON.stringify(event);
    const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    return app.inject({ method: 'POST', url: '/billing/webhook', headers: { 'stripe-signature': sig, 'content-type': 'application/json' }, payload });
  };
  let r = await app.inject({ method: 'POST', url: '/billing/webhook', headers: { 'stripe-signature': 'bad', 'content-type': 'application/json' }, payload: '{}' });
  assert.equal(r.statusCode, 400);
  r = await send({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { customer: 'cus_1', subscription: 'sub_1', client_reference_id: String(userId), metadata: { user_id: String(userId), plan: 'pro' } } } });
  assert.equal(r.statusCode, 200, r.body);
  let u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'pro'); assert.equal(u.stripe_customer_id, 'cus_1');
  r = await send({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } });
  assert.equal(r.json().duplicate, true);
  r = await send({ id: 'evt_2', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'active', items: { data: [{ price: { id: 'price_business' } }] } } } });
  u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'business');
  assert.equal((await app.inject({ method: 'GET', url: '/v1/usage', headers: hdr() })).json().limit, 25000);
  r = await send({ id: 'evt_3', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', items: { data: [{ price: { id: 'price_business' } }] } } } });
  u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'free'); assert.equal(u.stripe_subscription_id, null);
});

test('checkout without stripe configured fails cleanly', async () => {
  const r0 = await app.inject({ method: 'POST', url: '/login', payload: { email: 'test@example.com', password: 'password123' } });
  const sid = r0.cookies.find((c) => c.name === 'sid').value;
  const r = await app.inject({ method: 'POST', url: '/billing/checkout', cookies: { sid }, payload: { plan: 'pro' } });
  assert.equal(r.statusCode, 503);
});

test('concurrency: 6 parallel renders all succeed', async () => {
  const rs = await Promise.all(Array.from({ length: 6 }, (_, i) => app.inject({ method: 'POST', url: '/v1/screenshot', headers: hdr(), payload: { html: `<h1>${i}</h1>`, width: 300, height: 200 } })));
  for (const r of rs) assert.equal(r.statusCode, 200, r.body);
});
