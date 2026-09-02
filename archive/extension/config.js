// Shared configuration. Loaded as a classic script in the popup and the audit page.
const SITESWEEP = {
  EXTPAY_ID: 'sitesweep',          // the extension id registered on extensionpay.com
  FREE_PAGE_LIMIT: 25,              // pages per crawl on the free plan
  MAX_PAGE_LIMIT: 2000,             // hard cap on the Pro plan
  PAGE_TIMEOUT_MS: 25000,           // render + axe per page
  FETCH_TIMEOUT_MS: 15000,          // html fetch / link check
  LINK_CONCURRENCY: 6,
  VERSION: '1.0.0'
};
