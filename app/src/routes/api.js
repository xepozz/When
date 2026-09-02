'use strict';
const { pdfOptions, screenshotOptions, renderPdf, renderScreenshot } = require('../render/render');
const { userFromApiKey } = require('../auth');
const usage = require('../usage');

const err = (statusCode, message, code) => Object.assign(new Error(message), { statusCode, code });

module.exports = async function apiRoutes(app) {
  const { db, pool, config } = app;

  app.decorateRequest('apiUser', null);
  app.addHook('preHandler', async (req) => {
    const h = req.headers.authorization || '';
    const raw = h.startsWith('Bearer ') ? h.slice(7).trim() : (req.headers['x-api-key'] || (req.method === 'GET' ? req.query.api_key : undefined));
    const user = userFromApiKey(db, raw);
    if (!user) throw err(401, 'Missing or invalid API key. Pass it as "Authorization: Bearer rk_live_..."', 'unauthorized');
    req.apiUser = user;
  });

  await app.register(require('@fastify/rate-limit'), {
    hook: 'preHandler', // after the API-key hook above, so limits are per user and per plan
    max: (req) => (config.plans[req.apiUser?.plan] || config.plans.free).ratePerMin,
    timeWindow: '1 minute',
    keyGenerator: (req) => 'u' + (req.apiUser ? req.apiUser.id : req.ip),
    errorResponseBuilder: (req, ctx) => ({ statusCode: 429, error: { code: 'rate_limited', message: `Rate limit of ${ctx.max} requests per minute exceeded on the ${req.apiUser?.plan || 'free'} plan` } }),
  });

  app.get('/usage', async (req) => {
    const plan = config.plans[req.apiUser.plan] || config.plans.free;
    return { plan: req.apiUser.plan, used: usage.monthUsage(db, req.apiUser.id), limit: plan.monthly, period: require('../db').period() };
  });

  const handle = (kind) => async (req, reply) => {
    const q = req.method === 'GET' ? req.query : (req.body || {});
    const user = req.apiUser;
    const plan = config.plans[user.plan] || config.plans.free;
    const o = kind === 'pdf' ? pdfOptions(q, config.renderTimeoutMs) : screenshotOptions(q, config.renderTimeoutMs);
    const quota = usage.consume(db, user.id, plan.monthly);
    if (!quota.ok) throw err(402, `Monthly quota of ${plan.monthly} renders on the ${plan.name} plan is used up. Upgrade at ${config.appUrl}/pricing`, 'quota_exceeded');
    const t0 = Date.now();
    let out;
    try {
      out = kind === 'pdf' ? await renderPdf(pool, o, { allowPrivate: config.allowPrivateNetwork, timeoutMs: config.renderTimeoutMs }) : await renderScreenshot(pool, o, { allowPrivate: config.allowPrivateNetwork, timeoutMs: config.renderTimeoutMs });
    } catch (e) {
      usage.refund(db, user.id);
      usage.logRender(db, { userId: user.id, kind, source: o.url || 'html', ok: false, ms: Date.now() - t0, error: e.message });
      if (e.statusCode) throw e;
      throw err(422, 'Render failed: ' + (e.message || 'unknown error').split('\n')[0], 'render_failed');
    }
    const ms = Date.now() - t0;
    usage.logRender(db, { userId: user.id, kind, source: o.url || 'html', ok: true, ms, bytes: out.buffer.length });
    reply.header('X-RenderKit-Time', String(ms));
    reply.header('X-RenderKit-Usage', `${quota.used}/${quota.limit}`);
    if (q.response === 'json') return { content_type: out.contentType, bytes: out.buffer.length, ms, data: out.buffer.toString('base64') };
    reply.type(out.contentType);
    reply.header('Content-Disposition', `inline; filename="render.${out.ext}"`);
    reply.header('Cache-Control', 'private, max-age=0');
    return reply.send(out.buffer);
  };

  app.post('/pdf', handle('pdf'));
  app.get('/pdf', handle('pdf'));
  app.post('/screenshot', handle('screenshot'));
  app.get('/screenshot', handle('screenshot'));
};
