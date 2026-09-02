'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { build } = require('../src/server');
const auth = require('../src/auth');
const paddle = require('../src/billing/paddle');

const SECRET = 'pdl_ntfset_test_secret';
let app, userId, sid;

before(async () => {
  app = build({ logger: false, dbPath: ':memory:', appUrl: 'http://localhost:3000', billingProvider: 'paddle',
    paddle: { env: 'sandbox', apiKey: '', clientToken: 'test_client_token', webhookSecret: SECRET, prices: { starter: 'pri_starter', pro: 'pri_pro', business: 'pri_business' } } });
  await app.ready();
  const u = auth.createUser(app.db, 'paddle@example.com', 'password123');
  userId = u.userId;
  const r = await app.inject({ method: 'POST', url: '/login', payload: { email: 'paddle@example.com', password: 'password123' } });
  sid = r.cookies.find((c) => c.name === 'sid').value;
});
after(async () => { await app.close(); });

const send = (event, { secret = SECRET, ts } = {}) => {
  const payload = JSON.stringify(event);
  return app.inject({ method: 'POST', url: '/billing/paddle/webhook', headers: { 'paddle-signature': paddle.signForTest(payload, secret, ts), 'content-type': 'application/json' }, payload });
};

test('signature verification: valid, tampered, wrong secret, stale timestamp', () => {
  const body = '{"a":1}';
  const h = paddle.signForTest(body, SECRET);
  assert.equal(paddle.verifySignature(body, h, SECRET), true);
  assert.equal(paddle.verifySignature('{"a":2}', h, SECRET), false);
  assert.equal(paddle.verifySignature(body, h, 'other'), false);
  assert.equal(paddle.verifySignature(body, paddle.signForTest(body, SECRET, Math.floor(Date.now() / 1000) - 600), SECRET), false);
  assert.equal(paddle.verifySignature(body, 'garbage', SECRET), false);
  assert.equal(paddle.verifySignature(body, undefined, SECRET), false);
});

test('checkout page embeds Paddle overlay with the right price and user', async () => {
  const r = await app.inject({ method: 'POST', url: '/billing/checkout', cookies: { sid }, payload: { plan: 'pro' } });
  assert.equal(r.statusCode, 200, r.body);
  assert.match(r.body, /cdn\.paddle\.com\/paddle\/v2\/paddle\.js/);
  assert.match(r.body, /"pri_pro"/);
  assert.match(r.body, /Paddle\.Environment\.set\('sandbox'\)/);
  assert.match(r.body, new RegExp(`user_id: "${userId}"`));
  const bad = await app.inject({ method: 'POST', url: '/billing/checkout', cookies: { sid }, payload: { plan: 'free' } });
  assert.equal(bad.statusCode, 400);
  const anon = await app.inject({ method: 'POST', url: '/billing/checkout', payload: { plan: 'pro' } });
  assert.equal(anon.statusCode, 401);
});

test('webhook rejects bad signatures', async () => {
  let r = await app.inject({ method: 'POST', url: '/billing/paddle/webhook', headers: { 'paddle-signature': 'ts=1;h1=deadbeef', 'content-type': 'application/json' }, payload: '{}' });
  assert.equal(r.statusCode, 400);
  r = await send({ event_id: 'evt_x', event_type: 'transaction.completed', data: {} }, { secret: 'wrong' });
  assert.equal(r.statusCode, 400);
});

test('transaction.completed upgrades the plan; duplicates ignored', async () => {
  let r = await send({ event_id: 'evt_1', event_type: 'transaction.completed', data: { id: 'txn_1', customer_id: 'ctm_1', subscription_id: 'sub_1', custom_data: { user_id: String(userId), plan: 'pro' }, items: [{ price: { id: 'pri_pro' } }] } });
  assert.equal(r.statusCode, 200, r.body);
  let u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'pro'); assert.equal(u.stripe_customer_id, 'paddle:ctm_1'); assert.equal(u.stripe_subscription_id, 'paddle:sub_1');
  r = await send({ event_id: 'evt_1', event_type: 'transaction.completed', data: {} });
  assert.equal(r.json().duplicate, true);
  const usage = await app.inject({ method: 'GET', url: '/v1/usage', headers: { authorization: 'Bearer ' + app.db.prepare('SELECT prefix FROM api_keys WHERE user_id = ?').get(userId).prefix } });
  assert.equal(usage.statusCode, 401); // prefix is not the key; sanity that keys are not leaked
});

test('subscription.updated changes plan by price id, canceled drops to free (matched by subscription id, no custom_data)', async () => {
  let r = await send({ event_id: 'evt_2', event_type: 'subscription.updated', data: { id: 'sub_1', customer_id: 'ctm_1', status: 'active', items: [{ price: { id: 'pri_business' } }] } });
  assert.equal(r.statusCode, 200, r.body);
  let u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'business');
  r = await send({ event_id: 'evt_3', event_type: 'subscription.past_due', data: { id: 'sub_1', customer_id: 'ctm_1', status: 'past_due', items: [{ price: { id: 'pri_business' } }] } });
  u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'business', 'past_due keeps access until canceled');
  r = await send({ event_id: 'evt_4', event_type: 'subscription.canceled', data: { id: 'sub_1', customer_id: 'ctm_1', status: 'canceled', items: [{ price: { id: 'pri_business' } }] } });
  u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'free'); assert.equal(u.stripe_subscription_id, null);
  r = await send({ event_id: 'evt_5', event_type: 'subscription.activated', data: { id: 'sub_2', customer_id: 'ctm_1', status: 'active', items: [{ price: { id: 'pri_starter' } }] } });
  u = app.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(u.plan, 'starter', 'matched by paddle customer id'); assert.equal(u.stripe_subscription_id, 'paddle:sub_2');
  r = await send({ event_id: 'evt_6', event_type: 'subscription.updated', data: { id: 'sub_unknown', customer_id: 'ctm_unknown', status: 'active', items: [{ price: { id: 'pri_pro' } }] } });
  assert.equal(r.statusCode, 200, 'unknown subscription is ignored, not an error');
});

test('provider none: checkout fails cleanly; stripe webhook still guarded', async () => {
  const none = build({ logger: false, dbPath: ':memory:', appUrl: 'http://localhost:3000', billingProvider: 'none' });
  await none.ready();
  try {
    auth.createUser(none.db, 'n@example.com', 'password123');
    const r0 = await none.inject({ method: 'POST', url: '/login', payload: { email: 'n@example.com', password: 'password123' } });
    const s = r0.cookies.find((c) => c.name === 'sid').value;
    const r = await none.inject({ method: 'POST', url: '/billing/checkout', cookies: { sid: s }, payload: { plan: 'pro' } });
    assert.equal(r.statusCode, 503);
  } finally { await none.close(); }
});
