'use strict';
const path = require('node:path');

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const int = (k, d) => parseInt(env(k, d), 10);

// Prices: minor units (kopecks / cents) per month. CURRENCY=RUB (default, Russian market) or USD.
const CURRENCY = env('CURRENCY', 'RUB');
const PRICES = CURRENCY === 'RUB'
  ? { free: 0, starter: 79000, pro: 249000, business: 690000 }
  : { free: 0, starter: 900, pro: 2900, business: 7900 };
const PLANS = {
  free: { name: 'Free', monthly: 100, priceCents: PRICES.free, ratePerMin: 10, concurrency: 1 },
  starter: { name: 'Starter', monthly: 1000, priceCents: PRICES.starter, ratePerMin: 60, concurrency: 2 },
  pro: { name: 'Pro', monthly: 5000, priceCents: PRICES.pro, ratePerMin: 120, concurrency: 4 },
  business: { name: 'Business', monthly: 25000, priceCents: PRICES.business, ratePerMin: 300, concurrency: 8 },
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
  currency: CURRENCY,
  siteLang: env('SITE_LANG', 'ru'),
  legal: {
    name: env('LEGAL_NAME', ''),          // e.g. ИП Иванов Иван Иванович
    inn: env('LEGAL_INN', ''),
    ogrn: env('LEGAL_OGRN', ''),
    email: env('LEGAL_EMAIL', ''),
    address: env('LEGAL_ADDRESS', ''),
  },
  // 'yookassa' (Russia), 'paddle' (merchant of record, non-sanctioned countries), 'stripe', or 'none'
  billingProvider: env('BILLING_PROVIDER', env('YOOKASSA_SHOP_ID', '') ? 'yookassa' : (env('STRIPE_SECRET_KEY', '') ? 'stripe' : (env('PADDLE_CLIENT_TOKEN', '') ? 'paddle' : 'none'))),
  yookassa: {
    shopId: env('YOOKASSA_SHOP_ID', ''),
    secretKey: env('YOOKASSA_SECRET_KEY', ''),
    sendReceipt: env('YOOKASSA_SEND_RECEIPT', '1') === '1',   // 54-ФЗ receipts through YooKassa's fiscalization
    vatCode: int('YOOKASSA_VAT_CODE', 1),                      // 1 = без НДС (ИП на УСН / самозанятый)
    autopay: env('YOOKASSA_AUTOPAY', '1') === '1',             // save the card and charge monthly (needs "автоплатежи" enabled in the shop)
    graceDays: int('BILLING_GRACE_DAYS', 3),
  },
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
