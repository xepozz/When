'use strict';
const { chromium } = require('playwright-core');

/** One Chromium process, N isolated contexts at a time, a bounded queue. */
class BrowserPool {
  constructor({ concurrency = 4, maxQueue = 50, chromiumPath = '' } = {}) {
    this.concurrency = concurrency;
    this.maxQueue = maxQueue;
    this.chromiumPath = chromiumPath;
    this.browser = null;
    this.launching = null;
    this.active = 0;
    this.waiting = [];
    this.stats = { launched: 0, renders: 0, failures: 0 };
  }

  async getBrowser() {
    if (this.browser && this.browser.isConnected()) return this.browser;
    if (!this.launching) {
      this.launching = chromium.launch({
        executablePath: this.chromiumPath || undefined,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'],
      }).then((b) => { this.browser = b; this.stats.launched++; b.on('disconnected', () => { this.browser = null; }); return b; }).finally(() => { this.launching = null; });
    }
    return this.launching;
  }

  acquire() {
    if (this.active < this.concurrency) { this.active++; return Promise.resolve(); }
    if (this.waiting.length >= this.maxQueue) return Promise.reject(Object.assign(new Error('Render queue is full, retry shortly'), { statusCode: 503 }));
    return new Promise((resolve) => this.waiting.push(resolve)).then(() => { this.active++; });
  }
  release() {
    this.active--;
    const next = this.waiting.shift();
    if (next) next();
  }

  /** Run fn(context) in a fresh isolated context with a hard deadline. */
  async withContext(contextOptions, timeoutMs, fn) {
    await this.acquire();
    let context = null;
    let timer = null;
    try {
      const browser = await this.getBrowser();
      context = await browser.newContext(contextOptions);
      const deadline = new Promise((_, rej) => { timer = setTimeout(() => rej(Object.assign(new Error('Render timed out'), { statusCode: 504 })), timeoutMs); });
      const out = await Promise.race([fn(context), deadline]);
      this.stats.renders++;
      return out;
    } catch (e) {
      this.stats.failures++;
      throw e;
    } finally {
      clearTimeout(timer);
      if (context) context.close().catch(() => {});
      this.release();
    }
  }

  async close() { if (this.browser) await this.browser.close().catch(() => {}); this.browser = null; }
}

module.exports = { BrowserPool };
