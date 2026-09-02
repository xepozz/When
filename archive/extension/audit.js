(async function () {
  const $ = (id) => document.getElementById(id);
  const esc = SiteSweepReport.esc;
  const params = new URLSearchParams(location.search);
  let audit = null;
  let crawler = null;
  let pro = false;

  // ---- plan ----
  const user = await SiteSweepPro.getUser();
  pro = !!user.paid;
  $('plan').textContent = pro ? 'Pro' : 'Free plan';
  $('plan').classList.toggle('pro', pro);

  // ---- tabs ----
  for (const t of document.querySelectorAll('.tab')) {
    t.addEventListener('click', () => {
      for (const x of document.querySelectorAll('.tab')) { x.classList.toggle('active', x === t); x.setAttribute('aria-selected', x === t ? 'true' : 'false'); }
      for (const p of document.querySelectorAll('.panel')) p.hidden = p.id !== 'panel-' + t.dataset.tab;
    });
  }

  // ---- upsell modal ----
  const upsell = $('upsell');
  $('upsellClose').addEventListener('click', () => { upsell.hidden = true; });
  $('upsellPay').addEventListener('click', () => SiteSweepPro.openPaymentPage());
  $('upsellLogin').addEventListener('click', () => SiteSweepPro.openLoginPage());
  const requirePro = () => { if (pro) return true; upsell.hidden = false; return false; };

  // ---- exports ----
  $('exportHtml').addEventListener('click', () => { if (!audit || !requirePro()) return; SiteSweepReport.download(SiteSweepReport.baseName(audit) + '.html', SiteSweepReport.toHTML(audit), 'text/html'); });
  $('exportCsv').addEventListener('click', () => { if (!audit || !requirePro()) return; SiteSweepReport.download(SiteSweepReport.baseName(audit) + '.csv', SiteSweepReport.toCSV(audit), 'text/csv'); });
  $('exportJson').addEventListener('click', () => { if (!audit || !requirePro()) return; SiteSweepReport.download(SiteSweepReport.baseName(audit) + '.json', SiteSweepReport.toJSON(audit), 'application/json'); });

  // ---- progress ----
  function setStatus(text, frac) {
    $('status').textContent = text;
    if (typeof frac === 'number') $('fill').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
  }

  // ---- render ----
  function renderTiles(a) {
    const s = a.summary;
    $('tPages').textContent = s.pages;
    $('tPagesSub').textContent = `${s.pagesHtml} HTML · ${s.pagesError} unavailable` + (s.truncated ? ' · stopped at page limit' : '') + (a.stopped ? ' · stopped by you' : '');
    $('tA11y').textContent = s.a11yTotal;
    $('tA11ySub').textContent = a.settings.runA11y ? `${s.a11y.critical} critical · ${s.a11y.serious} serious · ${s.a11y.moderate} moderate · ${s.a11y.minor} minor` : 'skipped';
    $('tLinks').textContent = s.links.broken + s.links.error;
    $('tLinksSub').textContent = `${s.links.redirect} redirects · ${s.links.checked} of ${s.links.total} links checked` + (a.settings.checkExternal ? '' : ' · external links not checked');
    $('tSeo').textContent = s.seo.error + s.seo.warning;
    $('tSeoSub').textContent = a.settings.runSeo ? `${s.seo.error} errors · ${s.seo.warning} warnings · ${s.seo.info} notes` : 'skipped';
  }

  function renderA11y(a) {
    const impact = $('a11yImpact').value;
    const rules = SiteSweepReport.aggregateA11y(a).filter((r) => !impact || r.impact === impact);
    const engine = (a.pages.find((p) => p.a11y) || { a11y: {} }).a11y.engine;
    $('a11yEngine').textContent = a.settings.runA11y ? `axe-core ${engine || ''} · ${a.summary.a11yPages} pages rendered` + (a.pages.some((p) => p.a11yError) ? ` · ${a.pages.filter((p) => p.a11yError).length} pages could not be rendered` : '') : 'Accessibility checks were turned off for this audit.';
    const list = $('a11yList');
    if (!rules.length) { list.innerHTML = `<div class="empty">${a.settings.runA11y ? 'No accessibility violations detected by automated checks. Manual review is still needed for full WCAG conformance.' : 'Accessibility checks skipped.'}</div>`; return; }
    list.innerHTML = rules.map((r) => `
      <details class="item">
        <summary><span class="pill ${r.impact}">${r.impact}</span><div><div class="title">${esc(r.help)}</div><div class="sub">${esc(r.description)}${r.tags.length ? ' · ' + r.tags.map(esc).join(', ') : ''}</div></div><span class="count">${r.nodes} element${r.nodes === 1 ? '' : 's'} · ${r.pages.length} page${r.pages.length === 1 ? '' : 's'}</span></summary>
        <div class="body"><p><a href="${esc(r.helpUrl)}" target="_blank" rel="noopener">How to fix (Deque University)</a></p>
        ${r.pages.map((p) => `<div class="node"><div class="pagelink">${esc(p.url)} <span class="muted">· ${p.nodeCount} element${p.nodeCount === 1 ? '' : 's'}</span></div>${p.nodes.slice(0, 5).map((n) => `<code>${esc(n.target)}\n${esc(n.html)}</code>`).join('')}</div>`).join('')}
        </div>
      </details>`).join('');
  }

  function renderLinks(a) {
    const mode = $('linkKind').value;
    let links = a.links.filter((l) => l.kind);
    if (mode === 'problems') links = links.filter((l) => l.kind !== 'ok');
    else if (mode !== 'all') links = links.filter((l) => l.kind === mode);
    const order = { broken: 0, error: 1, redirect: 2, ok: 3 };
    links.sort((x, y) => order[x.kind] - order[y.kind] || x.url.localeCompare(y.url));
    $('linkNote').textContent = a.settings.checkExternal ? `${a.summary.links.external} external links included` : `${a.summary.links.external} external links were not checked (option in the popup)`;
    const list = $('linkList');
    if (!links.length) { list.innerHTML = '<div class="empty">Nothing to show for this filter.</div>'; return; }
    list.innerHTML = links.map((l) => `
      <details class="item">
        <summary><span class="pill ${l.kind}">${l.kind}${l.status ? ' ' + l.status : ''}</span><div><div class="title pagelink">${esc(l.url)}</div><div class="sub">${l.kind === 'redirect' ? '→ ' + esc(l.finalUrl) : ''}${l.error ? esc(l.error) : ''}${l.external ? ' · external' : ''}</div></div><span class="count">on ${l.sources.length} page${l.sources.length === 1 ? '' : 's'}</span></summary>
        <div class="body">${l.sources.map((s) => `<div class="node"><span class="pagelink">${esc(s.page)}</span> <span class="muted">· link text: “${esc(s.text || '(no text)')}”</span></div>`).join('')}</div>
      </details>`).join('');
  }

  function renderSeo(a) {
    const rules = SiteSweepReport.aggregateSeo(a);
    const list = $('seoList');
    if (!rules.length) { list.innerHTML = `<div class="empty">${a.settings.runSeo ? 'No SEO issues detected.' : 'SEO checks skipped.'}</div>`; return; }
    list.innerHTML = rules.map((r) => `
      <details class="item">
        <summary><span class="pill ${r.severity}">${r.severity}</span><div><div class="title">${esc(r.rule)}</div><div class="sub">${esc(r.pages[0].message)}</div></div><span class="count">${r.pages.length} page${r.pages.length === 1 ? '' : 's'}</span></summary>
        <div class="body">${r.pages.map((p) => `<div class="node"><span class="pagelink">${esc(p.url)}</span> <span class="muted">· ${esc(p.message)}</span></div>`).join('')}</div>
      </details>`).join('');
  }

  function renderPages(a) {
    const tbody = $('pagesTable').querySelector('tbody');
    tbody.innerHTML = a.pages.map((p) => `<tr><td class="pagelink">${esc(p.url)}${p.redirected ? '<br><span class="muted">→ ' + esc(p.finalUrl) + '</span>' : ''}</td><td class="num">${p.status || esc(p.error || 'error')}</td><td>${esc(p.title)}</td><td class="num">${p.a11y ? Object.values(p.a11y.counts).reduce((x, y) => x + y, 0) : (p.a11yError ? '<span class="muted" title="' + esc(p.a11yError) + '">n/a</span>' : '—')}</td><td class="num">${p.seo.length}</td><td class="num">${p.linkCount}</td><td class="num">${(p.size / 1024).toFixed(0)}</td><td class="num">${p.ms}</td></tr>`).join('');
  }

  function renderAll(a) {
    renderTiles(a); renderA11y(a); renderLinks(a); renderSeo(a); renderPages(a);
    window.__sitesweepAudit = a; // exposed for automated tests
  }
  $('a11yImpact').addEventListener('change', () => audit && renderA11y(audit));
  $('linkKind').addEventListener('change', () => audit && renderLinks(audit));

  async function persist(a) {
    try {
      await chrome.storage.local.set({ lastAudit: a, lastAuditMeta: { id: a.id, origin: a.origin, pages: a.summary.pages, startedAt: a.startedAt, finishedAt: a.finishedAt } });
    } catch (e) { /* storage full; keep in memory */ }
  }

  function finish(a) {
    audit = a;
    renderAll(a);
    setStatus(`Done · ${a.summary.pages} pages · ${a.summary.links.checked} links checked · ${Math.round((a.finishedAt - a.startedAt) / 1000)}s`, 1);
    $('stop').hidden = true;
    for (const id of ['exportHtml', 'exportCsv', 'exportJson']) $(id).disabled = false;
    if (!pro) { $('notice').hidden = false; $('notice').innerHTML = `Free plan: on-screen results for up to ${SITESWEEP.FREE_PAGE_LIMIT} pages. <a href="#" id="noticeUp">Pro</a> crawls up to ${SITESWEEP.MAX_PAGE_LIMIT} pages and exports HTML, CSV and JSON reports.`; $('noticeUp').addEventListener('click', (e) => { e.preventDefault(); SiteSweepPro.openPaymentPage(); }); }
  }

  // ---- entry ----
  if (params.get('view') === 'last') {
    const { lastAudit } = await chrome.storage.local.get('lastAudit');
    if (!lastAudit) { setStatus('No saved audit yet. Start one from the SiteSweep button.', 0); $('stop').hidden = true; return; }
    $('origin').textContent = lastAudit.origin;
    finish(lastAudit);
    return;
  }

  const start = params.get('start');
  if (!start || !/^https?:/i.test(start)) { setStatus('Missing start URL.', 0); $('stop').hidden = true; return; }
  const cap = pro ? SITESWEEP.MAX_PAGE_LIMIT : SITESWEEP.FREE_PAGE_LIMIT;
  const maxPages = Math.max(1, Math.min(parseInt(params.get('maxPages'), 10) || cap, cap));
  const opts = {
    startUrl: start,
    maxPages,
    checkExternal: params.get('checkExternal') === '1',
    runA11y: params.get('runA11y') !== '0',
    runSeo: params.get('runSeo') !== '0',
    pageTimeout: SITESWEEP.PAGE_TIMEOUT_MS,
    fetchTimeout: SITESWEEP.FETCH_TIMEOUT_MS,
    linkConcurrency: SITESWEEP.LINK_CONCURRENCY,
    onProgress: (p) => {
      if (p.phase === 'pages') setStatus(`Crawling ${p.done + 1} of up to ${maxPages}: ${p.current}`, (p.done / maxPages) * 0.8);
      else setStatus(`Checking links ${p.done} of ${p.total}`, 0.8 + (p.done / Math.max(1, p.total)) * 0.2);
    }
  };
  $('origin').textContent = new URL(start).origin;
  document.title = `SiteSweep · ${new URL(start).host}`;

  // Verify we actually hold the host permission (the popup asks for it; the URL can be typed by hand).
  const origins = opts.checkExternal ? ['http://*/*', 'https://*/*'] : [new URL(start).origin + '/*'];
  const has = await chrome.permissions.contains({ origins }).catch(() => false);
  if (!has) { setStatus('Permission to read this site was not granted. Start the audit from the SiteSweep button.', 0); $('stop').hidden = true; return; }

  crawler = new SiteSweepCrawler.Crawler(opts);
  $('stop').addEventListener('click', () => { crawler.stop(); setStatus('Stopping after the current page…'); });
  try {
    const result = await crawler.run();
    await persist(result);
    finish(result);
  } catch (e) {
    setStatus('Audit failed: ' + (e.message || e), 0);
    $('stop').hidden = true;
  }
})();
