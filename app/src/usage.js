'use strict';
const { period } = require('./db');

function monthUsage(db, userId, p = period()) {
  const row = db.prepare('SELECT count FROM usage WHERE user_id = ? AND period = ?').get(userId, p);
  return row ? row.count : 0;
}

/** Atomically consume one render if under the plan quota. Returns {ok, used, limit}. */
function consume(db, userId, limit, p = period()) {
  db.prepare('INSERT OR IGNORE INTO usage (user_id, period, count) VALUES (?, ?, 0)').run(userId, p);
  const res = db.prepare('UPDATE usage SET count = count + 1 WHERE user_id = ? AND period = ? AND count < ?').run(userId, p, limit);
  const used = monthUsage(db, userId, p);
  return { ok: res.changes === 1, used, limit };
}

function refund(db, userId, p = period()) {
  db.prepare('UPDATE usage SET count = MAX(count - 1, 0) WHERE user_id = ? AND period = ?').run(userId, p);
}

function logRender(db, { userId, kind, source, ok, ms, bytes, error }) {
  db.prepare('INSERT INTO renders (user_id, kind, source, ok, ms, bytes, error, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(userId ?? null, kind, source, ok ? 1 : 0, ms, bytes || 0, error ? String(error).slice(0, 300) : null, Date.now());
}

function recentRenders(db, userId, limit = 20) {
  return db.prepare('SELECT kind, source, ok, ms, bytes, error, created_at FROM renders WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(userId, limit);
}

function dailySeries(db, userId, days = 30) {
  const since = Date.now() - days * 86400000;
  const rows = db.prepare(`SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS n FROM renders WHERE user_id = ? AND ok = 1 AND created_at > ? GROUP BY day ORDER BY day`).all(userId, since);
  return rows;
}

module.exports = { monthUsage, consume, refund, logRender, recentRenders, dailySeries };
