// Paid-status helper shared by popup and audit page (classic script).
const SiteSweepPro = {
  cache: null,
  async getUser() {
    if (this.cache) return this.cache;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'sitesweep:getUser' });
      if (res && res.ok) {
        this.cache = res.user;
        return res.user;
      }
    } catch (_) { /* worker asleep or network down: treat as free */ }
    return { paid: false, email: null, subscriptionStatus: null, paidAt: null };
  },
  async isPro() {
    const u = await this.getUser();
    return !!u.paid;
  },
  openPaymentPage() {
    chrome.runtime.sendMessage({ type: 'sitesweep:openPayment' }).catch(() => {});
  },
  openLoginPage() {
    chrome.runtime.sendMessage({ type: 'sitesweep:openLogin' }).catch(() => {});
  }
};
