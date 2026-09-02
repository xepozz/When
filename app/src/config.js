'use strict';
const path = require('node:path');

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const int = (k, d) => parseInt(env(k, d), 10);

const PLANS = {
  free: { name: 'Free', monthly: 100, priceCents: 0, ratePerMin: 10, concurrency: 1 },
  starter: { name: 'Starter', monthly: 1000, priceCents: 900, ratePerMin: 60, concurrency: 2 },
  pro: { name: 'Pro', monthly: 5000, priceCents: 2900, ratePerMin: 120, concurrency: 4 },
  business: { name: 'Business', monthly: 25000, priceCents: 7900, ratePerMin: 300, concurrency: 8 },
};

module.exports = {
  appName: env('APP_NAME', 'RenderKit'),
  appUrl: env('APP_URL', 'http://localhost:3000'),
  port: int('PORT', 3000),
  host: env('HOST', '0.0.0.0'),
  dbPath: env('DATABASE_PATH', path.join(__dirname, '..', 'data', 'renderkit.db')),
  sessionSecret: env('SESSION_SECRET', 'change-me-in-production-please-32-bytes'),
  chromiumPath: env('CHROMIUM_PATH', ''),
  renderConcurrency: int('RENDER_CONCURRENCY', 4),
  renderTimeoutMs: int('RENDER_TIMEOUT_MS', 30000),
  maxQueue: int('RENDER_MAX_QUEUE', 50),
  allowPrivateNetwork: env('ALLOW_PRIVATE_NETWORK', '0') === '1',
  // 'stripe' (needs a Stripe-supported country), 'paddle' (merchant of record, any non-sanctioned country) or 'none'
  billingProvider: env('BILLING_PROVIDER', env('STRIPE_SECRET_KEY', '') ? 'stripe' : (env('PADDLE_CLIENT_TOKEN', '') ? 'paddle' : 'none')),
  paddle: {
    env: env('PADDLE_ENV', 'production'),            // 'sandbox' while testing
    apiKey: env('PADDLE_API_KEY', ''),
    clientToken: env('PADDLE_CLIENT_TOKEN', ''),
    webhookSecret: env('PADDLE_WEBHOOK_SECRET', ''),
    prices: {
      starter: env('PADDLE_PRICE_STARTER', ''),
      pro: env('PADDLE_PRICE_PRO', ''),
      business: env('PADDLE_PRICE_BUSINESS', ''),
    },
  },
  stripe: {
    secretKey: env('STRIPE_SECRET_KEY', ''),
    webhookSecret: env('STRIPE_WEBHOOK_SECRET', ''),
    prices: {
      starter: env('STRIPE_PRICE_STARTER', ''),
      pro: env('STRIPE_PRICE_PRO', ''),
      business: env('STRIPE_PRICE_BUSINESS', ''),
    },
  },
  plans: PLANS,
  freeToolPerHour: int('FREE_TOOL_PER_HOUR', 10),
};
