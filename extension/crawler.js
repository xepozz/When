// SiteSweep crawler. Runs inside the extension's audit page (a privileged extension document),
// which has host permissions for the audited origin, so fetch() is not CORS-restricted and
// the user's cookies are sent (audits work behind login).

const SKIP_EXT = /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|pdf|zip|gz|tgz|rar|7z|mp3|mp4|m4a|m4v|mov|avi|wmv|webm|ogg|wav|flac|css|js|mjs|json|xml|rss|atom|txt|csv|xlsx?|docx?|pptx?|woff2?|ttf|eot|otf|exe|dmg|apk|iso)(\?.*)?$/i;

function normalizeUrl(href, base) {
  let u;
  try { u = new URL(href, base); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  u.username = ''; u.password = '';
  let s = u.href;
  if (s.endsWith('?')) s = s.slice(0, -1);
  return s;
}

function sameSite(a, b) {
  try { return new URL(a).host === new URL(b).host; } catch { return false; }
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(t) };
}

async function fetchPage(url, timeoutMs) {
  const { signal, done } = withTimeout(timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(url, { credentials: 'include', redirect: 'follow', signal, headers: { 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' } });
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const isHtml = ct.includes('text/html') || ct.includes('application/xhtml');
    const html = isHtml ? await res.text() : '';
    done();
    return { status: res.status, ok: res.ok, redirected: res.redirected, finalUrl: res.url || url, contentType: ct, isHtml, html, size: html.length, ms: Math.round(performance.now() - t0), error: null };
  } catch (e) {
    done();
    return { status: 0, ok: false, redirected: false, finalUrl: url, contentType: '', isHtml: false, html: '', size: 0, ms: Math.round(performance.now() - t0), error: e.name === 'AbortError' ? 'timeout' : (e.message || String(e)) };
  }
}

async function checkLink(url, timeoutMs) {
  // HEAD first; many servers reject HEAD, so fall back to GET and drop the body.
  const attempt = async (method) => {
    const { signal, done } = withTimeout(timeoutMs);
    try {
      const res = await fetch(url, { method, credentials: 'include', redirect: 'follow', signal });
      const out = { status: res.status, redirected: res.redirected, finalUrl: res.url || url, error: null };
      done();
      if (method === 'GET' && res.body) { try { await res.body.cancel(); } catch { /* ignore */ } }
      return out;
    } catch (e) {
      done();
      return { status: 0, redirected: false, finalUrl: url, error: e.name === 'AbortError' ? 'timeout' : (e.message || String(e)) };
    }
  };
  let r = await attempt('HEAD');
  if (r.status === 405 || r.status === 403 || r.status === 501 || r.status === 400 || r.status === 0) {
    const g = await attempt('GET');
    if (g.status !== 0 || r.status === 0) r = g;
  }
  return r;
}

// ---------- SEO checks on the fetched HTML ----------
function analyzeHtml(html, pageUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const q = (sel) => doc.querySelector(sel);
  const title = (q('title') && q('title').textContent || '').trim();
  const descEl = q('meta[name="description" i]');
  const description = descEl ? (descEl.getAttribute('content') || '').trim() : null;
  const canonicalEl = q('link[rel="canonical" i]');
  const canonical = canonicalEl ? normalizeUrl(canonicalEl.getAttribute('href') || '', pageUrl) : null;
  const robotsEl = q('meta[name="robots" i]');
  const robots = robotsEl ? (robotsEl.getAttribute('content') || '').toLowerCase() : '';
  const noindex = robots.includes('noindex');
  const viewport = !!q('meta[name="viewport" i]');
  const h1s = Array.from(doc.querySelectorAll('h1'));
  const lang = (doc.documentElement.getAttribute('lang') || '').trim();
  const imgs = Array.from(doc.querySelectorAll('img'));
  const imgsNoAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;
  const words = (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length;

  const links = [];
  for (const a of doc.querySelectorAll('a[href]')) {
    const raw = a.getAttribute('href') || '';
    if (/^(mailto|tel|javascript|sms|data):/i.test(raw) || raw.trim() === '' || raw.trim() === '#') continue;
    const abs = normalizeUrl(raw, pageUrl);
    if (!abs) continue;
    links.push({ url: abs, text: (a.textContent || a.getAttribute('aria-label') || a.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 80), nofollow: /nofollow/i.test(a.getAttribute('rel') || '') });
  }

  const issues = [];
  const add = (severity, rule, message) => issues.push({ severity, rule, message });
  if (!title) add('error', 'missing-title', 'Page has no <title>.');
  else if (title.length > 65) add('warning', 'long-title', `Title is ${title.length} characters; search engines truncate around 60.`);
  else if (title.length < 15) add('info', 'short-title', `Title is only ${title.length} characters.`);
  if (description === null) add('warning', 'missing-description', 'No meta description.');
  else if (description.length === 0) add('warning', 'empty-description', 'Meta description is empty.');
  else if (description.length > 165) add('info', 'long-description', `Meta description is ${description.length} characters; ~155 is the visible limit.`);
  if (h1s.length === 0) add('warning', 'missing-h1', 'No <h1> heading.');
  else if (h1s.length > 1) add('info', 'multiple-h1', `${h1s.length} <h1> headings on one page.`);
  if (!canonical) add('info', 'missing-canonical', 'No canonical link.');
  else if (!sameSite(canonical, pageUrl)) add('info', 'cross-host-canonical', `Canonical points to another host: ${canonical}`);
  if (!viewport) add('warning', 'missing-viewport', 'No viewport meta tag; mobile rendering will be desktop-scaled.');
  if (noindex) add('info', 'noindex', 'Page is marked noindex.');
  if (imgsNoAlt > 0) add('warning', 'img-missing-alt', `${imgsNoAlt} of ${imgs.length} images have no alt attribute.`);
  if (words < 50) add('info', 'thin-content', `Only ${words} words of visible text.`);

  return { title, description, canonical, noindex, viewport, h1Count: h1s.length, lang, imgCount: imgs.length, imgsNoAlt, words, links, issues };
}

// ---------- Accessibility via axe-core in a real tab ----------
function loadInTab(tabId, url, timeoutMs) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => { cleanup(); reject(new Error('Page load timed out')); }, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') { cleanup(); resolve(); }
    }
    function removed(id) { if (id === tabId) { cleanup(); reject(new Error('Audit tab was closed')); } }
    function cleanup() {
      if (finished) return; finished = true;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.tabs.onRemoved.removeListener(removed);
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.onRemoved.addListener(removed);
    chrome.tabs.update(tabId, { url }).catch((e) => { cleanup(); reject(e); });
  });
}

function axeInPage() {
  // Executed inside the audited page after axe.min.js is injected.
  return axe.run(document, { resultTypes: ['violations'], iframes: false, reporter: 'v2' }).then((r) => ({
    url: location.href,
    testEngine: r.testEngine && r.testEngine.version,
    violations: r.violations.map((v) => ({
      id: v.id, impact: v.impact || 'minor', help: v.help, helpUrl: v.helpUrl, description: v.description,
      tags: v.tags.filter((t) => /^(wcag2a|wcag2aa|wcag21a|wcag21aa|wcag22aa|best-practice)$/.test(t)),
      nodes: v.nodes.slice(0, 20).map((n) => ({ target: (n.target || []).join(' '), html: (n.html || '').slice(0, 240), summary: (n.failureSummary || '').slice(0, 400) })),
      nodeCount: v.nodes.length
    }))
  }));
}

async function runAxe(tabId, url, timeoutMs) {
  await loadInTab(tabId, url, timeoutMs);
  await new Promise((r) => setTimeout(r, 400)); // let late scripts settle
  await chrome.scripting.executeScript({ target: { tabId }, files: ['axe.min.js'] });
  const results = await Promise.race([
    chrome.scripting.executeScript({ target: { tabId }, func: axeInPage }),
    new Promise((_, rej) => setTimeout(() => rej(new Error('axe timed out')), timeoutMs))
  ]);
  const first = results && results[0];
  if (!first || !first.result) throw new Error('axe returned no result');
  return first.result;
}

// ---------- The crawl ----------
class Crawler {
  constructor(opts) {
    this.startUrl = normalizeUrl(opts.startUrl, opts.startUrl);
    this.maxPages = opts.maxPages;
    this.checkExternal = !!opts.checkExternal;
    this.runA11y = opts.runA11y !== false;
    this.runSeo = opts.runSeo !== false;
    this.pageTimeout = opts.pageTimeout || 25000;
    this.fetchTimeout = opts.fetchTimeout || 15000;
    this.linkConcurrency = opts.linkConcurrency || 6;
    this.onProgress = opts.onProgress || (() => {});
    this.stopped = false;
    this.tabId = null;
    this.queue = [this.startUrl];
    this.seen = new Set([this.startUrl]);
    this.pages = [];
    this.linkMap = new Map(); // url -> { url, external, sources: [], status, kind }
  }

  stop() { this.stopped = true; }

  async run() {
    const startedAt = Date.now();
    if (this.runA11y) {
      const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
      this.tabId = tab.id;
    }
    try {
      while (this.queue.length && this.pages.length < this.maxPages && !this.stopped) {
        const url = this.queue.shift();
        this.onProgress({ phase: 'pages', current: url, done: this.pages.length, total: Math.min(this.maxPages, this.pages.length + this.queue.length + 1) });
        const page = await this.processPage(url);
        this.pages.push(page);
      }
      const truncated = !this.stopped && this.queue.length > 0;
      await this.checkLinks();
      return this.finish(startedAt, truncated);
    } finally {
      if (this.tabId !== null) { try { await chrome.tabs.remove(this.tabId); } catch { /* already closed */ } }
    }
  }

  async processPage(url) {
    const page = { url, finalUrl: url, status: 0, redirected: false, contentType: '', size: 0, ms: 0, error: null, isHtml: false,
      title: '', description: null, canonical: null, noindex: false, h1Count: 0, lang: '', imgCount: 0, imgsNoAlt: 0, words: 0,
      seo: [], a11y: null, a11yError: null, linkCount: 0 };
    const res = await fetchPage(url, this.fetchTimeout);
    Object.assign(page, { finalUrl: res.finalUrl, status: res.status, redirected: res.redirected, contentType: res.contentType, size: res.size, ms: res.ms, error: res.error, isHtml: res.isHtml });
    if (res.redirected && !sameSite(res.finalUrl, this.startUrl)) {
      page.seo.push({ severity: 'info', rule: 'redirects-offsite', message: `Redirects to another host: ${res.finalUrl}` });
      return page;
    }
    if (!res.isHtml || !res.html) return page;

    const a = analyzeHtml(res.html, res.finalUrl);
    Object.assign(page, { title: a.title, description: a.description, canonical: a.canonical, noindex: a.noindex, h1Count: a.h1Count, lang: a.lang, imgCount: a.imgCount, imgsNoAlt: a.imgsNoAlt, words: a.words, linkCount: a.links.length });
    if (this.runSeo) page.seo = page.seo.concat(a.issues);

    for (const l of a.links) {
      const external = !sameSite(l.url, this.startUrl);
      let entry = this.linkMap.get(l.url);
      if (!entry) { entry = { url: l.url, external, sources: [] }; this.linkMap.set(l.url, entry); }
      if (entry.sources.length < 50) entry.sources.push({ page: url, text: l.text });
      if (!external && !SKIP_EXT.test(l.url) && !this.seen.has(l.url)) {
        this.seen.add(l.url);
        this.queue.push(l.url);
      }
    }

    if (this.runA11y && this.tabId !== null && res.status >= 200 && res.status < 400) {
      try {
        const r = await runAxe(this.tabId, res.finalUrl, this.pageTimeout);
        const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        for (const v of r.violations) counts[v.impact] = (counts[v.impact] || 0) + v.nodeCount;
        page.a11y = { violations: r.violations, counts, engine: r.testEngine };
      } catch (e) {
        page.a11yError = e.message || String(e);
      }
    }
    return page;
  }

  async checkLinks() {
    const targets = Array.from(this.linkMap.values()).filter((l) => !l.external || this.checkExternal);
    // Internal pages we already fetched do not need a second request.
    const fetched = new Map(this.pages.map((p) => [p.url, p]));
    let i = 0, done = 0;
    const total = targets.length;
    const worker = async () => {
      while (i < targets.length && !this.stopped) {
        const l = targets[i++];
        const p = fetched.get(l.url);
        if (p) {
          Object.assign(l, { status: p.status, redirected: p.redirected, finalUrl: p.finalUrl, error: p.error });
        } else {
          const r = await checkLink(l.url, this.fetchTimeout);
          Object.assign(l, r);
        }
        l.kind = l.error ? 'error' : (l.status >= 400 || l.status === 0) ? 'broken' : l.redirected ? 'redirect' : 'ok';
        done++;
        if (done % 5 === 0 || done === total) this.onProgress({ phase: 'links', done, total, current: l.url });
      }
    };
    await Promise.all(Array.from({ length: this.linkConcurrency }, worker));
  }

  finish(startedAt, truncated) {
    const links = Array.from(this.linkMap.values());
    const a11yCounts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    let a11yPages = 0;
    for (const p of this.pages) {
      if (p.a11y) { a11yPages++; for (const k of Object.keys(a11yCounts)) a11yCounts[k] += p.a11y.counts[k] || 0; }
    }
    const byTitle = new Map(), byDesc = new Map();
    for (const p of this.pages) {
      if (!p.isHtml) continue;
      if (p.title) byTitle.set(p.title, (byTitle.get(p.title) || []).concat(p.url));
      if (p.description) byDesc.set(p.description, (byDesc.get(p.description) || []).concat(p.url));
    }
    if (this.runSeo) {
      for (const p of this.pages) {
        if (p.title && byTitle.get(p.title).length > 1) p.seo.push({ severity: 'warning', rule: 'duplicate-title', message: `Title shared with ${byTitle.get(p.title).length - 1} other page(s).` });
        if (p.description && byDesc.get(p.description).length > 1) p.seo.push({ severity: 'info', rule: 'duplicate-description', message: `Meta description shared with ${byDesc.get(p.description).length - 1} other page(s).` });
      }
    }
    const seoCounts = { error: 0, warning: 0, info: 0 };
    for (const p of this.pages) for (const s of p.seo) seoCounts[s.severity]++;
    const checked = links.filter((l) => l.kind);
    const summary = {
      pages: this.pages.length,
      pagesHtml: this.pages.filter((p) => p.isHtml).length,
      pagesError: this.pages.filter((p) => p.status === 0 || p.status >= 400).length,
      truncated,
      a11yPages,
      a11y: a11yCounts,
      a11yTotal: Object.values(a11yCounts).reduce((a, b) => a + b, 0),
      links: { total: links.length, checked: checked.length, broken: checked.filter((l) => l.kind === 'broken').length, redirect: checked.filter((l) => l.kind === 'redirect').length, error: checked.filter((l) => l.kind === 'error').length, external: links.filter((l) => l.external).length },
      seo: seoCounts
    };
    return {
      id: 'audit_' + startedAt.toString(36),
      version: 1,
      startUrl: this.startUrl,
      origin: new URL(this.startUrl).origin,
      startedAt, finishedAt: Date.now(),
      settings: { maxPages: this.maxPages, checkExternal: this.checkExternal, runA11y: this.runA11y, runSeo: this.runSeo },
      stopped: this.stopped,
      summary, pages: this.pages, links
    };
  }
}

window.SiteSweepCrawler = { Crawler, normalizeUrl, analyzeHtml, checkLink, fetchPage };
