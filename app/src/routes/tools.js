'use strict';
const { pdfOptions, screenshotOptions, renderPdf, renderScreenshot } = require('../render/render');
const usage = require('../usage');
const views = require('../../views');

// Free, no-signup tools. They are the top of the funnel and are rate-limited per IP.
module.exports = async function toolsRoutes(app) {
  const { pool, config, db } = app;

  await app.register(require('@fastify/rate-limit'), {
    max: config.freeToolPerHour, timeWindow: '1 hour',
    allowList: (req) => req.method === 'GET',
    errorResponseBuilder: () => ({ statusCode: 429, error: { code: 'rate_limited', message: `Free tools allow ${config.freeToolPerHour} renders per hour. Create a free account for 100 renders a month via the API.` } }),
  });

  app.get('/html-to-pdf', async (req, reply) => reply.type('text/html').send(views.toolPdf({ config })));
  app.get('/screenshot', async (req, reply) => reply.type('text/html').send(views.toolShot({ config })));

  const run = (kind) => async (req, reply) => {
    const q = { ...(req.body || {}) };
    q.timeout = Math.min(Number(q.timeout) || 15000, 15000);
    if (kind === 'screenshot') { q.width = Math.min(Number(q.width) || 1280, 1920); q.height = Math.min(Number(q.height) || 800, 1080); }
    const t0 = Date.now();
    try {
      const o = kind === 'pdf' ? pdfOptions(q, 15000) : screenshotOptions(q, 15000);
      const out = kind === 'pdf' ? await renderPdf(pool, o, { allowPrivate: config.allowPrivateNetwork, timeoutMs: 20000 }) : await renderScreenshot(pool, o, { allowPrivate: config.allowPrivateNetwork, timeoutMs: 20000 });
      usage.logRender(db, { userId: null, kind, source: o.url || 'html', ok: true, ms: Date.now() - t0, bytes: out.buffer.length });
      reply.type(out.contentType);
      reply.header('Content-Disposition', `${q.download ? 'attachment' : 'inline'}; filename="renderkit.${out.ext}"`);
      return reply.send(out.buffer);
    } catch (e) {
      usage.logRender(db, { userId: null, kind, source: q.url || 'html', ok: false, ms: Date.now() - t0, error: e.message });
      const page = kind === 'pdf' ? views.toolPdf : views.toolShot;
      return reply.code(e.statusCode && e.statusCode < 500 ? e.statusCode : 422).type('text/html').send(page({ config, error: e.message, values: q }));
    }
  };
  app.post('/html-to-pdf', run('pdf'));
  app.post('/screenshot', run('screenshot'));
};
