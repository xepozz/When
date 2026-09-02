(async function () {
  const $ = (id) => document.getElementById(id);
  const originEl = $('origin');
  const hintEl = $('originHint');
  const startBtn = $('start');
  const errorEl = $('error');
  let origin = null;
  let startUrl = null;

  // Which site? The active tab. activeTab grants us its URL after the popup opens.
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && /^https?:/i.test(tab.url)) {
      const u = new URL(tab.url);
      origin = u.origin;
      startUrl = u.href;
      originEl.textContent = origin;
      hintEl.textContent = 'Crawl starts at the current page and follows links on this host.';
    } else {
      originEl.textContent = 'Open a website tab first';
      hintEl.textContent = 'SiteSweep audits http(s) pages. Chrome pages and files are not supported.';
      startBtn.disabled = true;
    }
  } catch (e) {
    originEl.textContent = 'Cannot read the current tab';
    startBtn.disabled = true;
  }

  // Plan + limits
  const user = await SiteSweepPro.getUser();
  const pro = !!user.paid;
  $('plan').textContent = pro ? 'Pro plan' : 'Free plan';
  $('plan').classList.toggle('pro', pro);
  const maxPagesEl = $('maxPages');
  const settings = (await chrome.storage.local.get('settings')).settings || {};
  maxPagesEl.value = settings.maxPages || (pro ? 200 : SITESWEEP.FREE_PAGE_LIMIT);
  $('checkExternal').checked = !!settings.checkExternal;
  $('runA11y').checked = settings.runA11y !== false;
  $('runSeo').checked = settings.runSeo !== false;
  if (!pro) {
    maxPagesEl.max = SITESWEEP.FREE_PAGE_LIMIT;
    if (+maxPagesEl.value > SITESWEEP.FREE_PAGE_LIMIT) maxPagesEl.value = SITESWEEP.FREE_PAGE_LIMIT;
    $('limitHint').textContent = `Free plan crawls up to ${SITESWEEP.FREE_PAGE_LIMIT} pages. Pro: up to ${SITESWEEP.MAX_PAGE_LIMIT} pages and report export.`;
    $('upgrade').hidden = false;
  } else {
    maxPagesEl.max = SITESWEEP.MAX_PAGE_LIMIT;
    $('limitHint').textContent = `Up to ${SITESWEEP.MAX_PAGE_LIMIT} pages per crawl.`;
    $('upgrade').textContent = 'Manage subscription';
  }

  // Last audit
  const { lastAuditMeta } = await chrome.storage.local.get('lastAuditMeta');
  if (lastAuditMeta) {
    $('last').hidden = false;
    $('lastInfo').textContent = `${lastAuditMeta.origin} · ${lastAuditMeta.pages} pages · ${new Date(lastAuditMeta.finishedAt || lastAuditMeta.startedAt).toLocaleString()}`;
    $('openLast').addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('audit.html?view=last') });
      window.close();
    });
  }

  $('upgrade').addEventListener('click', () => SiteSweepPro.openPaymentPage());
  $('login').addEventListener('click', () => SiteSweepPro.openLoginPage());

  $('form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorEl.hidden = true;
    if (!origin) return;
    const maxPagesRaw = parseInt(maxPagesEl.value, 10) || SITESWEEP.FREE_PAGE_LIMIT;
    const cap = pro ? SITESWEEP.MAX_PAGE_LIMIT : SITESWEEP.FREE_PAGE_LIMIT;
    const maxPages = Math.max(1, Math.min(maxPagesRaw, cap));
    const checkExternal = $('checkExternal').checked;
    const runA11y = $('runA11y').checked;
    const runSeo = $('runSeo').checked;

    // Host permission for the audited site (and every site if external links are checked).
    // Must happen inside the click handler: Chrome requires a user gesture.
    const origins = checkExternal ? ['http://*/*', 'https://*/*'] : [origin + '/*'];
    let granted = false;
    try {
      granted = await chrome.permissions.request({ origins });
    } catch (e) {
      granted = false;
    }
    if (!granted) {
      errorEl.textContent = 'SiteSweep needs permission to read this site to audit it.';
      errorEl.hidden = false;
      return;
    }

    await chrome.storage.local.set({ settings: { maxPages, checkExternal, runA11y, runSeo } });
    const params = new URLSearchParams({ start: startUrl, maxPages, checkExternal: checkExternal ? 1 : 0, runA11y: runA11y ? 1 : 0, runSeo: runSeo ? 1 : 0 });
    await chrome.tabs.create({ url: chrome.runtime.getURL('audit.html?' + params.toString()) });
    window.close();
  });
})();
