'use strict';
const Stripe = require('stripe');
const paddle = require('../billing/paddle');
const { userFromSession } = require('../auth');
const views = require('../../views');

const err = (statusCode, message) => Object.assign(new Error(message), { statusCode });

function stripePlanFromPrice(config, priceId) {
  for (const [plan, id] of Object.entries(config.stripe.prices)) if (id && id === priceId) return plan;
  return null;
}

module.exports = async function billingRoutes(app) {
  const { db, config } = app;
  const provider = config.billingProvider; // 'stripe' | 'paddle' | 'none'
  const stripe = provider === 'stripe' && config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;

  const requireUser = (req) => {
    const user = userFromSession(db, req.cookies.sid);
    if (!user) throw err(401, 'Log in first');
    return user;
  };
  const planOf = (req) => {
    const plan = String((req.body || {}).plan || '');
    if (!config.plans[plan] || plan === 'free') throw err(400, 'Unknown plan');
    return plan;
  };

  app.post('/checkout', async (req, reply) => {
    const user = requireUser(req);
    const plan = planOf(req);
    if (provider === 'stripe') {
      const price = config.stripe.prices[plan];
      if (!stripe || !price) throw err(503, 'Billing is not configured yet (Stripe keys or prices missing)');
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription', line_items: [{ price, quantity: 1 }],
        customer: user.stripe_customer_id && !user.stripe_customer_id.startsWith('paddle:') ? user.stripe_customer_id : undefined,
        customer_email: user.stripe_customer_id ? undefined : user.email,
        client_reference_id: String(user.id), metadata: { user_id: String(user.id), plan },
        subscription_data: { metadata: { user_id: String(user.id), plan } }, allow_promotion_codes: true,
        success_url: `${config.appUrl}/dashboard?upgraded=1`, cancel_url: `${config.appUrl}/pricing`,
      });
      return reply.redirect(session.url, 303);
    }
    if (provider === 'paddle') {
      const price = config.paddle.prices[plan];
      if (!config.paddle.clientToken || !price) throw err(503, 'Billing is not configured yet (Paddle client token or prices missing)');
      return reply.type('text/html').send(views.paddleCheckout({ config, user, plan, priceId: price }));
    }
    throw err(503, 'Billing is not configured yet (set BILLING_PROVIDER)');
  });

  app.post('/portal', async (req, reply) => {
    const user = requireUser(req);
    if (!user.stripe_customer_id) return reply.redirect('/pricing', 303);
    if (provider === 'stripe' && stripe) {
      const session = await stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${config.appUrl}/dashboard` });
      return reply.redirect(session.url, 303);
    }
    if (provider === 'paddle' && config.paddle.apiKey) {
      const url = await paddle.portalUrl(config, user.stripe_customer_id.replace(/^paddle:/, ''));
      if (!url) throw err(502, 'Paddle did not return a portal URL');
      return reply.redirect(url, 303);
    }
    throw err(503, 'Billing is not configured yet');
  });

  // Webhooks need the raw body for signature verification.
  app.register(async function (sub) {
    sub.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body, done) => done(null, body));

    sub.post('/webhook', async (req) => {
      if (!config.stripe.webhookSecret) throw err(503, 'STRIPE_WEBHOOK_SECRET missing');
      let event;
      try { event = Stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], config.stripe.webhookSecret); }
      catch (e) { throw err(400, 'Invalid signature: ' + e.message); }
      if (db.prepare('SELECT 1 FROM stripe_events WHERE id = ?').get(event.id)) return { received: true, duplicate: true };
      db.prepare('INSERT INTO stripe_events (id, type, created_at) VALUES (?, ?, ?)').run(event.id, event.type, Date.now());
      applyStripeEvent(db, config, event, app.log);
      return { received: true };
    });

    sub.post('/paddle/webhook', async (req) => {
      if (!config.paddle.webhookSecret) throw err(503, 'PADDLE_WEBHOOK_SECRET missing');
      const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body || '');
      if (!paddle.verifySignature(raw, req.headers['paddle-signature'], config.paddle.webhookSecret)) throw err(400, 'Invalid signature');
      const event = JSON.parse(raw);
      const id = 'paddle:' + event.event_id;
      if (db.prepare('SELECT 1 FROM stripe_events WHERE id = ?').get(id)) return { received: true, duplicate: true };
      db.prepare('INSERT INTO stripe_events (id, type, created_at) VALUES (?, ?, ?)').run(id, event.event_type, Date.now());
      const result = paddle.applyEvent(db, config, event);
      app.log.info({ event: event.event_id, type: event.event_type, result }, 'paddle webhook');
      return { received: true };
    });
  }, { prefix: '' });
};

function applyStripeEvent(db, config, event, log) {
  const obj = event.data.object;
  if (event.type === 'checkout.session.completed') {
    const userId = Number(obj.metadata?.user_id || obj.client_reference_id);
    const plan = obj.metadata?.plan;
    if (!userId || !config.plans[plan]) { log.warn({ event: event.id }, 'checkout without user/plan metadata'); return; }
    db.prepare('UPDATE users SET plan = ?, stripe_customer_id = ?, stripe_subscription_id = ? WHERE id = ?')
      .run(plan, typeof obj.customer === 'string' ? obj.customer : obj.customer?.id || null, typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id || null, userId);
    return;
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const customer = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
    const user = db.prepare('SELECT * FROM users WHERE stripe_customer_id = ? OR stripe_subscription_id = ?').get(customer || '', obj.id) || (obj.metadata?.user_id ? db.prepare('SELECT * FROM users WHERE id = ?').get(Number(obj.metadata.user_id)) : null);
    if (!user) { log.warn({ event: event.id }, 'subscription event for unknown customer'); return; }
    const active = event.type === 'customer.subscription.updated' && ['active', 'trialing', 'past_due'].includes(obj.status);
    const priceId = obj.items?.data?.[0]?.price?.id;
    const plan = active ? (stripePlanFromPrice(config, priceId) || obj.metadata?.plan || user.plan) : 'free';
    db.prepare('UPDATE users SET plan = ?, stripe_customer_id = COALESCE(stripe_customer_id, ?), stripe_subscription_id = ? WHERE id = ?')
      .run(config.plans[plan] ? plan : 'free', customer || null, active ? obj.id : null, user.id);
  }
}

module.exports.applyEvent = applyStripeEvent;
