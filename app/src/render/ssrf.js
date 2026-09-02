'use strict';
const dns = require('node:dns').promises;
const net = require('node:net');

function ipIsPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l === '::1' || l === '::') return true;
    if (l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80')) return true;
    if (l.startsWith('::ffff:')) return ipIsPrivate(l.slice(7));
    return false;
  }
  return true; // not an IP at all
}

const cache = new Map();
async function hostIsPrivate(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (net.isIP(h)) return ipIsPrivate(h);
  const hit = cache.get(h);
  if (hit && hit.until > Date.now()) return hit.priv;
  let priv;
  try {
    const addrs = await dns.lookup(h, { all: true, verbatim: true });
    priv = addrs.length === 0 || addrs.some((a) => ipIsPrivate(a.address));
  } catch {
    priv = true; // unresolvable: treat as blocked
  }
  cache.set(h, { priv, until: Date.now() + 60000 });
  return priv;
}

/** Throws if the URL is not http(s) or points into a private network. */
async function assertPublicUrl(urlStr, allowPrivate) {
  const bad = (m) => Object.assign(new Error(m), { statusCode: 400 });
  let u;
  try { u = new URL(urlStr); } catch { throw bad('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw bad('Only http and https URLs are allowed');
  if (allowPrivate) return u;
  if (await hostIsPrivate(u.hostname.replace(/^\[|\]$/g, ''))) throw bad('URL points to a private or unresolvable host');
  return u;
}

module.exports = { ipIsPrivate, hostIsPrivate, assertPublicUrl };
