'use strict';
const path = require('node:path');
const fastify = require('fastify');
const config = require('./config');
const { open } = require('./db');
const { BrowserPool } = require('./render/pool');
const views = require('../views');

function build(overrides = {}) {
  const cfg = { ...config, ...overrides, stripe: { ...config.stripe, ...(overrides.stripe || {}) }, paddle: { ...config.paddle, ...(overrides.paddle || {}) } };
  const app = fastify({ logger: overrides.logger ?? { level: process.env.LOG_LEVEL || 'info' }, bodyLimit: 4 * 1024 * 1024, trustProxy: true });
  const db = open(cfg.dbPath);
  const pool = new BrowserPool({ concurrency: cfg.renderConcurrency, maxQueue: cfg.maxQueue, chromiumPath: cfg.chromiumPath });
  app.decorate('config', cfg);
  app.decorate('db', db);
  app.decorate('pool', pool);

  app.register(require('@fastify/cookie'), { secret: cfg.sessionSecret });
  app.register(require('@fastify/formbody'));
  app.register(require('@fastify/static'), { root: path.join(__dirname, '..', 'public'), prefix: '/static/' });

  // Same-origin check for browser form posts (cookies are SameSite=Lax; this closes the remaining gap).
  app.addHook('preHandler', async (req, reply) => {
    if (req.method !== 'POST' || req.url.startsWith('/v1/') || req.url.startsWith('/billing/webhook') || req.url.startsWith('/billing/paddle/webhook')) return;
    const origin = req.headers.origin || (req.headers.referer ? new URL(req.headers.referer).origin : null);
    if (origin && origin !== new URL(cfg.appUrl).origin && !origin.startsWith('http://localhost') && !origin.startsWith('http://127.0.0.1')) {
      reply.code(403).type('text/html').send(views.error({ config: cfg, status: 403, message: 'Cross-site form submission blocked.' }));
    }
  });

  app.setErrorHandler((error, req, reply) => {
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    if (status >= 500 && !error.statusCode) req.log.error(error); else if (status >= 500) req.log.warn({ err: error.message }, 'expected 5xx');
    const message = status >= 500 ? 'Internal error' : error.message;
    if (req.url.startsWith('/v1/') || req.url.includes('/webhook') || (req.headers.accept || '').includes('application/json')) {
      return reply.code(status).send({ error: { code: error.code || (status === 429 ? 'rate_limited' : 'error'), message: error.validation ? error.message : message } });
    }
    return reply.code(status).type('text/html').send(views.error({ config: cfg, status, message }));
  });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/v1/')) return reply.code(404).send({ error: { code: 'not_found', message: 'No such endpoint' } });
    return reply.code(404).type('text/html').send(views.error({ config: cfg, status: 404, message: 'Page not found' }));
  });

  app.register(require('./routes/pages'));
  app.register(require('./routes/dashboard'));
  app.register(require('./routes/api'), { prefix: '/v1' });
  app.register(require('./routes/billing'), { prefix: '/billing' });
  app.register(require('./routes/tools'), { prefix: '/tools' });

  app.addHook('onClose', async () => { await pool.close(); db.close(); });
  return app;
}

module.exports = { build };
