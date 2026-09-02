'use strict';
const { build } = require('./server');
const config = require('./config');

const app = build();
app.listen({ port: config.port, host: config.host }).then(() => {
  app.pool.getBrowser().catch((e) => app.log.error(e, 'browser failed to launch'));
}).catch((e) => { app.log.error(e); process.exit(1); });

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => app.close().then(() => process.exit(0)));
