importScripts('ExtPay.js', 'config.js');

// ExtensionPay must be started once in the service worker.
const extpay = ExtPay(SITESWEEP.EXTPAY_ID);
extpay.startBackground();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ installedAt: Date.now() });
  }
});

// The audit page asks the worker for paid status so that ExtPay's storage-backed
// user cache is shared in one place.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'sitesweep:getUser') {
    const ep = ExtPay(SITESWEEP.EXTPAY_ID);
    ep.getUser()
      .then((user) => sendResponse({ ok: true, user: serializeUser(user) }))
      .catch((err) => sendResponse({ ok: false, error: String(err && err.message || err) }));
    return true;
  }
  if (msg && msg.type === 'sitesweep:openPayment') {
    ExtPay(SITESWEEP.EXTPAY_ID).openPaymentPage().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }
  if (msg && msg.type === 'sitesweep:openLogin') {
    ExtPay(SITESWEEP.EXTPAY_ID).openLoginPage().catch(() => {});
    sendResponse({ ok: true });
    return false;
  }
  return false;
});

function serializeUser(user) {
  return {
    paid: !!user.paid,
    email: user.email || null,
    subscriptionStatus: user.subscriptionStatus || null,
    paidAt: user.paidAt ? new Date(user.paidAt).toISOString() : null
  };
}
