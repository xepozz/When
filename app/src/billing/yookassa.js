'use strict';
// ЮKassa (YooKassa) integration for the Russian market.
// Flow: create payment (redirect confirmation) → user pays → notification → we fetch the payment by id from the API
// (notifications are not signed; fetching is the documented way to trust them) → plan + paid_until set.
// Renewals: a daily job charges the saved payment method (автоплатёж) for users whose period ends.
const crypto = require('node:crypto');

const API = 'https://api.yookassa.ru/v3';
const PERIOD_MS = 30 * 24 * 3600 * 1000;

function authHeader(cfg) { return 'Basic ' + Buffer.from(`${cfg.yookassa.shopId}:${cfg.yookassa.secretKey}`).toString('base64'); }
function amountOf(cfg, plan) { return { value: (cfg.plans[plan].priceCents / 100).toFixed(2), currency: cfg.currency }; }

function receiptFor(cfg, user, plan) {
  if (!cfg.yookassa.sendReceipt) return undefined;
  return {
    customer: { email: user.email },
    items: [{ description: `${cfg.appName}: тариф ${cfg.plans[plan].name}, 30 дней`, quantity: '1.00', amount: amountOf(cfg, plan), vat_code: cfg.yookassa.vatCode, payment_mode: 'full_payment', payment_subject: 'service' }],
  };
}

async function api(cfg, fetchImpl, method, path, body, idemKey) {
  const res = await fetchImpl(API + path, {
    method,
    headers: { Authorization: authHeader(cfg), 'Content-Type': 'application/json', ...(idemKey ? { 'Idempotence-Key': idemKey } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep null */ }
  if (!res.ok) throw Object.assign(new Error(`YooKassa ${res.status}: ${(json && json.description) || text.slice(0, 200)}`), { statusCode: 502 });
  return json;
}

/** First payment for a plan. Returns the URL to redirect the user to. */
async function createPayment(db, cfg, fetchImpl, user, plan) {
  const id = crypto.randomUUID();
  const body = {
    amount: amountOf(cfg, plan),
    capture: true,
    confirmation: { type: 'redirect', return_url: `${cfg.appUrl}/dashboard?upgraded=1` },
    description: `${cfg.appName}: тариф ${cfg.plans[plan].name}, 30 дней`,
    save_payment_method: !!cfg.yookassa.autopay,
    metadata: { user_id: String(user.id), plan },
    receipt: receiptFor(cfg, user, plan),
  };
  const p = await api(cfg, fetchImpl, 'POST', '/payments', body, id);
  db.prepare('INSERT INTO payments (id, user_id, plan, amount, currency, status, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, user.id, plan, cfg.plans[plan].priceCents, cfg.currency, p.status, 'initial', Date.now(), Date.now());
  const url = p.confirmation && p.confirmation.confirmation_url;
  if (!url) throw Object.assign(new Error('YooKassa did not return a confirmation URL'), { statusCode: 502 });
  return url;
}

/** Apply a payment object (fetched from the API) to the user. Idempotent. */
function applyPayment(db, cfg, p, now = Date.now()) {
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(p.id);
  const userId = row ? row.user_id : Number(p.metadata && p.metadata.user_id);
  const plan = row ? row.plan : (p.metadata && p.metadata.plan);
  if (!userId || !cfg.plans[plan] || plan === 'free') return 'ignored: unknown payment';
  if (!row) db.prepare('INSERT INTO payments (id, user_id, plan, amount, currency, status, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(p.id, userId, plan, Math.round(Number(p.amount.value) * 100), p.amount.currency, p.status, 'initial', now, now);
  if (row && row.status === 'succeeded') return 'already applied';
  db.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?').run(p.status, now, p.id);
  if (p.status !== 'succeeded') return `status ${p.status}`;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return 'ignored: no user';
  // Extend from the current period end when renewing the same plan, otherwise start a fresh period.
  const base = user.plan === plan && user.paid_until && user.paid_until > now ? user.paid_until : now;
  const paidUntil = base + PERIOD_MS;
  const method = p.payment_method && p.payment_method.saved ? p.payment_method.id : null;
  db.prepare('UPDATE users SET plan = ?, provider = ?, paid_until = ?, payment_method_id = COALESCE(?, payment_method_id), pending_plan = NULL WHERE id = ?')
    .run(plan, 'yookassa', paidUntil, method, userId);
  return `plan ${plan} until ${new Date(paidUntil).toISOString()}`;
}

/** Notification handler: never trust the body, fetch the payment by id. */
async function handleNotification(db, cfg, fetchImpl, body) {
  const id = body && body.object && body.object.id;
  const event = body && body.event;
  if (!id || typeof id !== 'string' || !/^[A-Za-z0-9_-]{4,64}$/.test(id)) return 'ignored: malformed';
  if (event === 'refund.succeeded') {
    const paymentId = body.object.payment_id;
    const row = paymentId && db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (row) { db.prepare("UPDATE users SET plan = 'free', paid_until = NULL WHERE id = ?").run(row.user_id); db.prepare("UPDATE payments SET status = 'refunded', updated_at = ? WHERE id = ?").run(Date.now(), paymentId); return 'refunded'; }
    return 'ignored: refund for unknown payment';
  }
  const p = await api(cfg, fetchImpl, 'GET', '/payments/' + id);
  return applyPayment(db, cfg, p);
}

/** Daily renewal job: charge saved cards for periods that ended; downgrade after the grace period. */
async function runRenewals(db, cfg, fetchImpl, log, now = Date.now()) {
  const grace = cfg.yookassa.graceDays * 24 * 3600 * 1000;
  const due = db.prepare("SELECT * FROM users WHERE provider = 'yookassa' AND plan != 'free' AND paid_until IS NOT NULL AND paid_until < ?").all(now);
  const out = { charged: 0, failed: 0, downgraded: 0 };
  for (const user of due) {
    const recent = db.prepare("SELECT 1 FROM payments WHERE user_id = ? AND kind = 'renewal' AND created_at > ?").get(user.id, now - 20 * 3600 * 1000);
    if (user.payment_method_id && cfg.yookassa.autopay && !recent) {
      try {
        const id = crypto.randomUUID();
        const p = await api(cfg, fetchImpl, 'POST', '/payments', {
          amount: amountOf(cfg, user.plan), capture: true, payment_method_id: user.payment_method_id,
          description: `${cfg.appName}: продление тарифа ${cfg.plans[user.plan].name}, 30 дней`,
          metadata: { user_id: String(user.id), plan: user.plan, renewal: '1' }, receipt: receiptFor(cfg, user, user.plan),
        }, id);
        // Insert as pending, then let applyPayment move it to its final status (keeps the idempotency check meaningful).
        db.prepare('INSERT INTO payments (id, user_id, plan, amount, currency, status, kind, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(p.id, user.id, user.plan, cfg.plans[user.plan].priceCents, cfg.currency, 'pending', 'renewal', now, now);
        applyPayment(db, cfg, p, now);
        if (p.status === 'succeeded') { out.charged++; continue; }
        out.failed++;
      } catch (e) {
        out.failed++;
        if (log) log.warn({ user: user.id, err: e.message }, 'renewal charge failed');
      }
    }
    if (user.paid_until + grace < now) {
      db.prepare("UPDATE users SET plan = 'free', paid_until = NULL, pending_plan = NULL WHERE id = ?").run(user.id);
      out.downgraded++;
    }
  }
  return out;
}

module.exports = { createPayment, applyPayment, handleNotification, runRenewals, PERIOD_MS };
