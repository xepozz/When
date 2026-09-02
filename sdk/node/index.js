'use strict';
/**
 * const { RenderKit } = require('renderkit-client');
 * const rk = new RenderKit(process.env.RENDERKIT_KEY, { baseUrl: 'https://YOUR-RENDERKIT-HOST' });
 * const pdf = await rk.pdf({ html: '<h1>Invoice</h1>', format: 'A4' });   // Buffer
 */
class RenderKitError extends Error {
  constructor(message, status, code) { super(message); this.name = 'RenderKitError'; this.status = status; this.code = code; }
  get isQuotaExceeded() { return this.code === 'quota_exceeded'; }
  get isRateLimited() { return this.code === 'rate_limited'; }
}

class RenderKit {
  constructor(apiKey, { baseUrl = 'https://api.renderkit.example', timeoutMs = 60000, fetch: fetchImpl } = {}) {
    if (!apiKey) throw new Error('RenderKit: apiKey is required');
    this.apiKey = apiKey; this.baseUrl = baseUrl.replace(/\/$/, ''); this.timeoutMs = timeoutMs; this.fetch = fetchImpl || globalThis.fetch;
  }
  pdf(options) { return this._request('pdf', options); }
  screenshot(options) { return this._request('screenshot', options); }
  async usage() { const buf = await this._request('usage', null, 'GET'); return JSON.parse(buf.toString('utf8')); }
  async _request(endpoint, body, method = 'POST') {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetch(`${this.baseUrl}/v1/${endpoint}`, {
        method, signal: ctrl.signal,
        headers: { Authorization: 'Bearer ' + this.apiKey, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      if (res.status !== 200) {
        let msg = 'HTTP ' + res.status, code = 'error';
        try { const j = JSON.parse(buf.toString('utf8')); msg = j.error?.message || msg; code = j.error?.code || code; } catch { /* not json */ }
        throw new RenderKitError(msg, res.status, code);
      }
      return buf;
    } finally { clearTimeout(t); }
  }
}

module.exports = { RenderKit, RenderKitError };
