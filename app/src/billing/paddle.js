'use strict';
// Paddle Billing: merchant of record, sellers from any non-sanctioned country, no Stripe needed.
// Checkout is Paddle.js overlay on our page; webhooks tell us about paid state.
const crypto = require('node:crypto');

function apiBase(env) { return env === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'; }

/** Verify `Paddle-Signature: ts=...;h1=...` against the raw body. */
function verifySignature(rawBody, header, secret, { toleranceSec = 300, now = Date.now() } = {}) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(String(header).split(';').map((kv) => kv.split('=')));
  const ts = parts.ts, h1 = parts.h1;
  if (!ts || !h1) return false;
  if (Math.abs(now / 1000 - Number(ts)) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(h1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Test helper: build a valid signature header. */
function signForTest(rawBody, secret, ts = Math.floor(Date.now() / 1000)) {
  return `ts=${ts};h1=${crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex')}`;
}

function planFromPrice(config, priceId) {
  for (const [plan, id] of Object.entries(config.paddle.prices)) if (id && id === priceId) return plan;
  return null;
}

/** Apply a Paddle event to the users table. Returns a short description for logs. */
function applyEvent(db, config, event) {
  const type = event.event_type;
  const d = event.data || {};
  const custom = d.custom_data || {};
  const userId = Number(custom.user_id) || null;
  const priceId = d.items && d.items[0] && (d.items[0].price ? d.items[0].price.id : d.items[0].price_id);
  const planFromItems = planFromPrice(config, priceId) || (config.plans[custom.plan] ? custom.plan : null);

  const findUser = () => (userId && db.prepare('SELECT * FROM users WHERE id = ?').get(userId))
    || (d.customer_id && db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?').get('paddle:' + d.customer_id))
    || (d.subscription_id && db.prepare('SELECT * FROM users WHERE stripe_subscription_id = ?').get('paddle:' + d.subscription_id))
    || (d.id && type.startsWith('subscription.') && db.prepare('SELECT * FROM users WHERE stripe_subscription_id = ?').get('paddle:' + d.id))
    || null;

  if (type === 'transaction.completed') {
    const user = findUser();
    if (!user || !planFromItems) return 'ignored: no user/plan';
    db.prepare('UPDATE users SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?')
      .run(planFromItems, d.customer_id ? 'paddle:' + d.customer_id : null, d.subscription_id ? 'paddle:' + d.subscription_id : null, user.id);
    return `plan ${planFromItems} for user ${user.id}`;
  }
  if (['subscription.activated', 'subscription.updated', 'subscription.resumed', 'subscription.canceled', 'subscription.paused', 'subscription.past_due'].includes(type)) {
    const user = findUser();
    if (!user) return 'ignored: unknown subscription';
    const active = ['active', 'trialing', 'past_due'].includes(d.status);
    const plan = active ? (planFromItems || user.plan) : 'free';
    db.prepare('UPDATE users SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = ? WHERE id = ?')
      .run(config.plans[plan] ? plan : 'free', d.customer_id ? 'paddle:' + d.customer_id : null, active ? 'paddle:' + d.id : null, user.id);
    return `subscription ${d.status} -> plan ${plan} for user ${user.id}`;
  }
  return 'ignored: ' + type;
}

/** Customer portal URL via Paddle API (needs the customer to exist in Paddle). */
async function portalUrl(config, customerId) {
  const res = await fetch(`${apiBase(config.paddle.env)}/customers/${encodeURIComponent(customerId)}/portal-sessions`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + config.paddle.apiKey, 'Content-Type': 'application/json' }, body: '{}',
  });
  if (!res.ok) throw Object.assign(new Error('Paddle portal error ' + res.status), { statusCode: 502 });
  const j = await res.json();
  return j.data && j.data.urls && j.data.urls.general && j.data.urls.general.overview;
}

module.exports = { verifySignature, signForTest, applyEvent, portalUrl, planFromPrice };
