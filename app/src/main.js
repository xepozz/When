'use strict';
const { build } = require('./server');
const config = require('./config');

const app = build();
app.listen({ port: config.port, host: config.host }).then(() => {
  app.pool.getBrowser().catch((e) => app.log.error(e, 'browser failed to launch'));
}).catch((e) => { app.log.error(e); process.exit(1); });

// Daily renewals for YooKassa autopayments (Stripe/Paddle renew on their side).
if (config.billingProvider === 'yookassa') {
  const { runRenewals } = require('./billing/yookassa');
  const tick = () => runRenewals(app.db, app.config, app.fetch, app.log).then((r) => app.log.info(r, 'renewals')).catch((e) => app.log.error(e, 'renewals failed'));
  setTimeout(tick, 60 * 1000);
  setInterval(tick, 6 * 3600 * 1000);
}

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.close().then(() => process.exit(0)));
