'use strict';
const { assertPublicUrl, hostIsPrivate } = require('./ssrf');

const PAPER = new Set(['Letter', 'Legal', 'Tabloid', 'Ledger', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6']);
const WAIT = new Set(['load', 'domcontentloaded', 'networkidle', 'commit']);

const bad = (msg) => Object.assign(new Error(msg), { statusCode: 400 });
const num = (v, lo, hi, d) => { if (v === undefined || v === null || v === '') return d; const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) throw bad(`Value ${v} out of range ${lo}..${hi}`); return n; };
const bool = (v, d) => (v === undefined || v === null || v === '' ? d : (v === true || v === 'true' || v === '1' || v === 1));
const str = (v, max = 2000) => (v === undefined || v === null ? undefined : String(v).slice(0, max));

/** Validate and normalise request options shared by both endpoints. */
function commonOptions(q, timeoutCap) {
  const o = {};
  o.url = str(q.url, 8192);
  o.html = typeof q.html === 'string' ? q.html : undefined;
  if (!o.url && !o.html) throw bad('Provide "url" or "html"');
  if (o.url && o.html) throw bad('Provide either "url" or "html", not both');
  if (o.html && o.html.length > 2 * 1024 * 1024) throw bad('html exceeds 2 MB');
  o.width = num(q.width, 100, 4000, 1280);
  o.height = num(q.height, 100, 4000, 800);
  o.scale = num(q.device_scale_factor ?? q.scale, 1, 3, 1);
  o.waitUntil = q.wait_until ? String(q.wait_until) : 'load';
  if (!WAIT.has(o.waitUntil)) throw bad('wait_until must be one of load, domcontentloaded, networkidle, commit');
  o.delay = num(q.delay, 0, 10000, 0);
  o.timeout = num(q.timeout, 1000, timeoutCap, Math.min(20000, timeoutCap));
  o.waitFor = str(q.wait_for, 500);
  o.userAgent = str(q.user_agent, 500);
  o.darkMode = bool(q.dark_mode, false);
  o.hide = str(q.hide, 2000);
  o.css = typeof q.css === 'string' ? q.css.slice(0, 50000) : undefined;
  o.blockAds = bool(q.block_ads, false);
  o.locale = str(q.locale, 20);
  o.timezone = str(q.timezone, 60);
  return o;
}

function pdfOptions(q, timeoutCap) {
  const o = commonOptions(q, timeoutCap);
  o.format = q.format ? String(q.format) : 'A4';
  if (!PAPER.has(o.format)) throw bad('format must be one of ' + [...PAPER].join(', '));
  o.landscape = bool(q.landscape, false);
  o.printBackground = bool(q.print_background, true);
  o.pdfScale = num(q.pdf_scale, 0.1, 2, 1);
  o.margin = str(q.margin, 60) ?? '10mm';
  o.pageRanges = str(q.page_ranges, 100);
  o.headerTemplate = typeof q.header_template === 'string' ? q.header_template.slice(0, 20000) : undefined;
  o.footerTemplate = typeof q.footer_template === 'string' ? q.footer_template.slice(0, 20000) : undefined;
  o.preferCssPageSize = bool(q.prefer_css_page_size, false);
  o.media = q.media === 'screen' ? 'screen' : 'print';
  return o;
}

function screenshotOptions(q, timeoutCap) {
  const o = commonOptions(q, timeoutCap);
  o.type = q.format ? String(q.format) : 'png';
  if (!['png', 'jpeg', 'webp'].includes(o.type)) throw bad('format must be png, jpeg or webp');
  o.quality = num(q.quality, 1, 100, 80);
  o.fullPage = bool(q.full_page, false);
  o.selector = str(q.selector, 500);
  o.omitBackground = bool(q.transparent, false);
  o.clip = q.clip ? String(q.clip) : undefined;
  return o;
}

async function prepare(context, o, allowPrivate) {
  if (o.url) await assertPublicUrl(o.url, allowPrivate);
  const page = await context.newPage();
  if (!allowPrivate) {
    await page.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return route.continue();
      if (o.blockAds && /doubleclick|googlesyndication|adservice|adnxs|taboola|outbrain|hotjar|facebook\.net\/.*fbevents/i.test(u.host + u.pathname)) return route.abort();
      if (await hostIsPrivate(u.hostname)) return route.abort();
      return route.continue();
    });
  }
  if (o.darkMode) await page.emulateMedia({ colorScheme: 'dark' });
  if (o.url) await page.goto(o.url, { waitUntil: o.waitUntil, timeout: o.timeout });
  else await page.setContent(o.html, { waitUntil: o.waitUntil, timeout: o.timeout });
  if (o.waitFor) await page.waitForSelector(o.waitFor, { timeout: o.timeout });
  if (o.hide) await page.addStyleTag({ content: `${o.hide}{visibility:hidden !important}` }).catch(() => {});
  if (o.css) await page.addStyleTag({ content: o.css });
  if (o.delay) await page.waitForTimeout(o.delay);
  return page;
}

function contextOptions(o) {
  return {
    viewport: { width: o.width, height: o.height },
    deviceScaleFactor: o.scale,
    userAgent: o.userAgent,
    locale: o.locale,
    timezoneId: o.timezone,
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
  };
}

async function renderPdf(pool, o, { allowPrivate, timeoutMs }) {
  return pool.withContext(contextOptions(o), timeoutMs, async (context) => {
    const page = await prepare(context, o, allowPrivate);
    await page.emulateMedia({ media: o.media, colorScheme: o.darkMode ? 'dark' : 'light' });
    const margin = { top: o.margin, right: o.margin, bottom: o.margin, left: o.margin };
    const buf = await page.pdf({
      format: o.format, landscape: o.landscape, printBackground: o.printBackground, scale: o.pdfScale, margin,
      pageRanges: o.pageRanges, preferCSSPageSize: o.preferCssPageSize,
      displayHeaderFooter: !!(o.headerTemplate || o.footerTemplate), headerTemplate: o.headerTemplate || '<span></span>', footerTemplate: o.footerTemplate || '<span></span>',
    });
    return { buffer: buf, contentType: 'application/pdf', ext: 'pdf' };
  });
}

async function renderScreenshot(pool, o, { allowPrivate, timeoutMs }) {
  return pool.withContext(contextOptions(o), timeoutMs, async (context) => {
    const page = await prepare(context, o, allowPrivate);
    // Chromium screenshots are png/jpeg; WebP is produced from the PNG via a canvas inside the page.
    const wantWebp = o.type === 'webp';
    const shot = { type: wantWebp ? 'png' : o.type, fullPage: o.fullPage, omitBackground: o.omitBackground, animations: 'disabled' };
    if (o.type === 'jpeg') shot.quality = o.quality;
    if (o.clip) {
      const [x, y, w, h] = o.clip.split(',').map(Number);
      if ([x, y, w, h].some((n) => !Number.isFinite(n)) || w <= 0 || h <= 0) throw bad('clip must be "x,y,width,height"');
      shot.clip = { x, y, width: w, height: h };
    }
    let buf;
    if (o.selector) {
      const el = await page.waitForSelector(o.selector, { timeout: o.timeout });
      buf = await el.screenshot(shot);
    } else {
      buf = await page.screenshot(shot);
    }
    if (wantWebp) {
      try {
        const b64 = await page.evaluate(async ([png, q]) => {
          const img = new Image();
          img.src = 'data:image/png;base64,' + png;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          const out = c.toDataURL('image/webp', q / 100);
          if (!out.startsWith('data:image/webp')) throw new Error('no webp encoder');
          return out.split(',')[1];
        }, [buf.toString('base64'), o.quality]);
        buf = Buffer.from(b64, 'base64');
      } catch (e) {
        throw bad('WebP encoding failed for this page (too large or blocked by its CSP); use format=png or jpeg');
      }
    }
    const ct = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[o.type];
    return { buffer: buf, contentType: ct, ext: o.type === 'jpeg' ? 'jpg' : o.type };
  });
}

module.exports = { pdfOptions, screenshotOptions, renderPdf, renderScreenshot };
