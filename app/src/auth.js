'use strict';
const crypto = require('node:crypto');

const SESSION_TTL = 30 * 24 * 3600 * 1000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + key.toString('hex');
}
function verifyPassword(password, stored) {
  const [algo, saltHex, keyHex] = String(stored).split('$');
  if (algo !== 'scrypt') return false;
  const key = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
  return crypto.timingSafeEqual(key, Buffer.from(keyHex, 'hex'));
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

function newApiKey() {
  const raw = 'rk_live_' + crypto.randomBytes(24).toString('hex');
  return { raw, hash: sha256(raw), prefix: raw.slice(0, 15) };
}

function createUser(db, email, password) {
  const now = Date.now();
  const info = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)').run(email.toLowerCase().trim(), hashPassword(password), now);
  const userId = Number(info.lastInsertRowid);
  const key = newApiKey();
  db.prepare('INSERT INTO api_keys (user_id, key_hash, prefix, name, created_at) VALUES (?, ?, ?, ?, ?)').run(userId, key.hash, key.prefix, 'default', now);
  return { userId, apiKey: key.raw };
}

function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) || null;
}

function userFromApiKey(db, raw) {
  if (!raw || !/^rk_live_[0-9a-f]{48}$/.test(raw)) return null;
  const row = db.prepare(`SELECT u.*, k.id AS key_id FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = ? AND k.revoked_at IS NULL`).get(sha256(raw));
  return row || null;
}

function createSession(db, userId) {
  const id = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db.prepare('INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(id, userId, now, now + SESSION_TTL);
  return id;
}
function userFromSession(db, sid) {
  if (!sid || !/^[0-9a-f]{64}$/.test(sid)) return null;
  const row = db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?').get(sid, Date.now());
  return row || null;
}
function destroySession(db, sid) { if (sid) db.prepare('DELETE FROM sessions WHERE id = ?').run(sid); }

module.exports = { hashPassword, verifyPassword, sha256, newApiKey, createUser, findUserByEmail, userFromApiKey, createSession, userFromSession, destroySession };
