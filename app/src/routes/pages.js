'use strict';
const views = require('../../views');
const { userFromSession } = require('../auth');

module.exports = async function pages(app) {
  const { config, db } = app;
  const ctx = (req) => ({ config, user: userFromSession(db, req.cookies.sid) });
  app.get('/', async (req, reply) => reply.type('text/html').send(views.home(ctx(req))));
  app.get('/pricing', async (req, reply) => reply.type('text/html').send(views.pricing(ctx(req))));
  app.get('/docs', async (req, reply) => reply.type('text/html').send(views.docs({ ...ctx(req), lang: 'curl' })));
  app.get('/docs/:lang', async (req, reply) => {
    if (!views.DOC_LANGS.includes(req.params.lang)) return reply.callNotFound();
    return reply.type('text/html').send(views.docs({ ...ctx(req), lang: req.params.lang }));
  });
  app.get('/health', async () => ({ ok: true, browser: !!(app.pool.browser && app.pool.browser.isConnected()), active: app.pool.active, queued: app.pool.waiting.length, stats: app.pool.stats }));
  app.get('/robots.txt', async (req, reply) => reply.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /dashboard\nSitemap: ${config.appUrl}/sitemap.xml\n`));
  app.get('/sitemap.xml', async (req, reply) => {
    const urls = ['/', '/pricing', '/docs', ...views.DOC_LANGS.map((l) => '/docs/' + l), '/tools/html-to-pdf', '/tools/screenshot'];
    reply.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${config.appUrl}${u}</loc></url>`).join('')}</urlset>`);
  });
};
