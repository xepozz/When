'use strict';
const auth = require('../auth');
const usage = require('../usage');
const views = require('../../views');

module.exports = async function dashboardRoutes(app) {
  const { db, config } = app;
  const cookieOpts = { path: '/', httpOnly: true, sameSite: 'lax', secure: config.appUrl.startsWith('https://'), maxAge: 30 * 24 * 3600 };

  const currentUser = (req) => auth.userFromSession(db, req.cookies.sid);

  app.get('/signup', async (req, reply) => reply.type('text/html').send(views.signup({ config, user: currentUser(req) })));
  app.post('/signup', async (req, reply) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).type('text/html').send(views.signup({ config, error: 'Enter a valid email address.', email }));
    if (password.length < 8) return reply.code(400).type('text/html').send(views.signup({ config, error: 'Password must be at least 8 characters.', email }));
    if (auth.findUserByEmail(db, email)) return reply.code(400).type('text/html').send(views.signup({ config, error: 'An account with this email already exists. Log in instead.', email }));
    const { userId, apiKey } = auth.createUser(db, email, password);
    reply.setCookie('sid', auth.createSession(db, userId), cookieOpts);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    return reply.type('text/html').send(renderDashboard(app, user, { newKey: apiKey }));
  });

  app.get('/login', async (req, reply) => reply.type('text/html').send(views.login({ config, user: currentUser(req) })));
  app.post('/login', async (req, reply) => {
    const email = String(req.body?.email || '');
    const password = String(req.body?.password || '');
    const user = auth.findUserByEmail(db, email);
    if (!user || !auth.verifyPassword(password, user.password_hash)) return reply.code(401).type('text/html').send(views.login({ config, error: 'Wrong email or password.', email }));
    reply.setCookie('sid', auth.createSession(db, user.id), cookieOpts);
    return reply.redirect('/dashboard', 303);
  });

  app.post('/logout', async (req, reply) => {
    auth.destroySession(db, req.cookies.sid);
    reply.clearCookie('sid', { path: '/' });
    return reply.redirect('/', 303);
  });

  app.get('/dashboard', async (req, reply) => {
    const user = currentUser(req);
    if (!user) return reply.redirect('/login', 303);
    return reply.type('text/html').send(renderDashboard(app, user, { upgraded: req.query.upgraded === '1' }));
  });

  app.post('/dashboard/keys', async (req, reply) => {
    const user = currentUser(req);
    if (!user) return reply.redirect('/login', 303);
    const count = db.prepare('SELECT COUNT(*) c FROM api_keys WHERE user_id = ? AND revoked_at IS NULL').get(user.id).c;
    if (count >= 10) return reply.type('text/html').send(renderDashboard(app, user, { error: 'Maximum of 10 active keys.' }));
    const key = auth.newApiKey();
    const name = String(req.body?.name || 'key').slice(0, 40) || 'key';
    db.prepare('INSERT INTO api_keys (user_id, key_hash, prefix, name, created_at) VALUES (?, ?, ?, ?, ?)').run(user.id, key.hash, key.prefix, name, Date.now());
    return reply.type('text/html').send(renderDashboard(app, user, { newKey: key.raw }));
  });

  app.post('/dashboard/keys/:id/revoke', async (req, reply) => {
    const user = currentUser(req);
    if (!user) return reply.redirect('/login', 303);
    db.prepare('UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?').run(Date.now(), Number(req.params.id), user.id);
    return reply.redirect('/dashboard', 303);
  });
};

function renderDashboard(app, user, extra = {}) {
  const { db, config } = app;
  const plan = config.plans[user.plan] || config.plans.free;
  return views.dashboard({
    config, user, plan,
    used: usage.monthUsage(db, user.id),
    keys: db.prepare('SELECT id, prefix, name, created_at FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY id').all(user.id),
    recent: usage.recentRenders(db, user.id, 15),
    series: usage.dailySeries(db, user.id, 30),
    billingReady: !!config.stripe.secretKey,
    ...extra,
  });
}
