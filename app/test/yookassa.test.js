'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../src/server');
const auth = require('../src/auth');
const yk = require('../src/billing/yookassa');

// A fake YooKassa API: records requests, returns canned payments.
const calls = [];
const payments = new Map();
let nextStatus = 'pending';
const fakeFetch = async (url, init = {}) => {
  calls.push({ url, init });
  const m = url.match(/\/v3\/payments(?:\/([^/]+))?$/);
  const json = (o, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(o) });
  if (init.method === 'POST') {
    const body = JSON.parse(init.body);
    const id = 'pay_' + (payments.size + 1);
    const p = { id, status: body.payment_method_id ? 'succeeded' : nextStatus, amount: body.amount, metadata: body.metadata,
      confirmation: body.payment_method_id ? undefined : { type: 'redirect', confirmation_url: 'https://yoomoney.ru/checkout/' + id },
      payment_method: { id: body.payment_method_id || 'pm_saved_1', saved: !!(body.save_payment_method || body.payment_method_id) } };
    payments.set(id, p);
    return json(p);
  }
  if (m && m[1]) return payments.has(m[1]) ? json(payments.get(m[1])) : json({ description: 'not found' }, 404);
  return json({ description: 'unexpected' }, 500);
};

let app, userId, sid;
before(async () => {
  app = build({ logger: false, dbPath: ':memory:', appUrl: 'http://localhost:3000', billingProvider: 'yookassa', currency: 'RUB', fetch: fakeFetch,
    yookassa: { shopId: '123', secretKey: 'test_key', sendReceipt: true, vatCode: 1, autopay: true, graceDays: 3 } });
  await app.ready();
  userId = auth.createUser(app.db, 'ru@example.com', 'password123').userId;
  const r = await app.inject({ method: 'POST', url: '/login', payload: { email: 'ru@example.com', password: 'password123' } });
  sid = r.cookies.find((c) => c.name === 'sid').value;
});
after(async () => { await app.close(); });

const user = () => app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

test('checkout creates a payment with receipt, saved method and redirects to the confirmation URL', async () => {
  const r = await app.inject({ method: 'POST', url: '/billing/checkout', cookies: { sid }, payload: { plan: 'pro' } });
  assert.equal(r.statusCode, 303, r.body);
  assert.match(r.headers.location, /^https:\/\/yoomoney\.ru\/checkout\/pay_1$/);
  const call = calls.find((c) => c.init.method === 'POST');
  const body = JSON.parse(call.init.body);
  assert.equal(body.amount.value, '2490.00'); assert.equal(body.amount.currency, 'RUB');
  assert.equal(body.capture, true); assert.equal(body.save_payment_method, true);
  assert.equal(body.metadata.user_id, String(userId)); assert.equal(body.metadata.plan, 'pro');
  assert.equal(body.receipt.customer.email, 'ru@example.com'); assert.equal(body.receipt.items[0].vat_code, 1);
  assert.ok(call.init.headers['Idempotence-Key']);
  assert.match(call.init.headers.Authorization, /^Basic /);
  assert.equal(app.db.prepare('SELECT status FROM payments WHERE id = ?').get('pay_1').status, 'pending');
  assert.equal(user().plan, 'free', 'not upgraded before payment succeeds');
});

test('notification is verified against the API, not trusted; success upgrades for 30 days', async () => {
  // Forged notification claiming success while the API still says pending
  let r = await app.inject({ method: 'POST', url: '/billing/yookassa/webhook', headers: { 'content-type': 'application/json' }, payload: { event: 'payment.succeeded', object: { id: 'pay_1', status: 'succeeded' } } });
  assert.equal(r.statusCode, 200);
  assert.equal(user().plan, 'free', 'forged success ignored');
  payments.get('pay_1').status = 'succeeded';
  r = await app.inject({ method: 'POST', url: '/billing/yookassa/webhook', headers: { 'content-type': 'application/json' }, payload: { event: 'payment.succeeded', object: { id: 'pay_1' } } });
  assert.equal(r.statusCode, 200);
  const u = user();
  assert.equal(u.plan, 'pro'); assert.equal(u.provider, 'yookassa'); assert.equal(u.payment_method_id, 'pm_saved_1');
  assert.ok(u.paid_until > Date.now() + 29 * 86400000 && u.paid_until < Date.now() + 31 * 86400000);
  const usage = await app.inject({ method: 'GET', url: '/v1/usage', headers: { authorization: 'Bearer ' + auth.newApiKey().raw } });
  assert.equal(usage.statusCode, 401);
  // duplicate notification does not extend the period twice
  const before = u.paid_until;
  await app.inject({ method: 'POST', url: '/billing/yookassa/webhook', headers: { 'content-type': 'application/json' }, payload: { event: 'payment.succeeded', object: { id: 'pay_1' } } });
  assert.equal(user().paid_until, before);
  // malformed / unknown ids are ignored, not 500
  r = await app.inject({ method: 'POST', url: '/billing/yookassa/webhook', headers: { 'content-type': 'application/json' }, payload: { event: 'payment.succeeded', object: { id: '../etc' } } });
  assert.equal(r.statusCode, 200);
});

test('renewal job charges the saved card when the period ends and extends by 30 days', async () => {
  const now = Date.now();
  app.db.prepare('UPDATE users SET paid_until = ? WHERE id = ?').run(now - 1000, userId);
  const res = await yk.runRenewals(app.db, app.config, fakeFetch, null, now);
  assert.equal(res.charged, 1);
  const u = user();
  assert.equal(u.plan, 'pro');
  assert.ok(u.paid_until > now + 29 * 86400000);
  const renewal = app.db.prepare("SELECT * FROM payments WHERE kind = 'renewal'").get();
  assert.equal(renewal.status, 'succeeded');
  const call = calls[calls.length - 1];
  assert.equal(JSON.parse(call.init.body).payment_method_id, 'pm_saved_1');
  // running again the same day does not double-charge
  app.db.prepare('UPDATE users SET paid_until = ? WHERE id = ?').run(now - 1000, userId);
  const again = await yk.runRenewals(app.db, app.config, fakeFetch, null, now + 1000);
  assert.equal(again.charged, 0);
});

test('cancel stops autopay, access remains until paid_until, then downgrade after grace', async () => {
  let r = await app.inject({ method: 'POST', url: '/billing/cancel', cookies: { sid } });
  assert.equal(r.statusCode, 303);
  assert.equal(user().payment_method_id, null);
  assert.equal(user().plan, 'pro', 'still paid until period end');
  const end = user().paid_until;
  let res = await yk.runRenewals(app.db, app.config, fakeFetch, null, end + 1000);
  assert.equal(res.downgraded, 0, 'inside grace period');
  res = await yk.runRenewals(app.db, app.config, fakeFetch, null, end + 4 * 86400000);
  assert.equal(res.downgraded, 1);
  assert.equal(user().plan, 'free');
});

test('refund notification drops the plan', async () => {
  payments.get('pay_1').status = 'succeeded';
  app.db.prepare("UPDATE payments SET status = 'pending' WHERE id = 'pay_1'").run();
  await app.inject({ method: 'POST', url: '/billing/yookassa/webhook', headers: { 'content-type': 'application/json' }, payload: { event: 'payment.succeeded', object: { id: 'pay_1' } } });
  assert.equal(user().plan, 'pro');
  await app.inject({ method: 'POST', url: '/billing/yookassa/webhook', headers: { 'content-type': 'application/json' }, payload: { event: 'refund.succeeded', object: { id: 'rf_1', payment_id: 'pay_1' } } });
  assert.equal(user().plan, 'free');
});

test('dashboard shows rubles, period end and payment history', async () => {
  app.db.prepare("UPDATE users SET plan = 'pro', paid_until = ?, payment_method_id = 'pm_saved_1' WHERE id = ?").run(Date.now() + 10 * 86400000, userId);
  const r = await app.inject({ method: 'GET', url: '/dashboard', cookies: { sid } });
  assert.equal(r.statusCode, 200);
  assert.match(r.body, /₽/);
  assert.match(r.body, /pay_1|Оплаты|Платежи/);
});
