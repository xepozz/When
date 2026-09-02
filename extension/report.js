// Export helpers: CSV, JSON and a standalone HTML report (print to PDF from the browser).
const SiteSweepReport = (() => {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const csvCell = (s) => { const v = String(s == null ? '' : s); return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const fmtDate = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  function rows(audit) {
    const out = [['type', 'page', 'severity', 'rule', 'message', 'target', 'help_url', 'status', 'final_url']];
    for (const p of audit.pages) {
      if (p.a11y) for (const v of p.a11y.violations) for (const n of v.nodes) out.push(['accessibility', p.url, v.impact, v.id, v.help, n.target, v.helpUrl, '', '']);
      for (const s of p.seo) out.push(['seo', p.url, s.severity, s.rule, s.message, '', '', p.status, p.finalUrl]);
      if (p.status === 0 || p.status >= 400) out.push(['page', p.url, 'error', 'page-unavailable', p.error || ('HTTP ' + p.status), '', '', p.status, p.finalUrl]);
    }
    for (const l of audit.links) {
      if (!l.kind || l.kind === 'ok') continue;
      for (const src of l.sources) out.push(['link', src.page, l.kind === 'redirect' ? 'info' : 'error', 'link-' + l.kind, l.error || ('HTTP ' + l.status), l.url, '', l.status, l.finalUrl || '']);
    }
    return out;
  }

  function toCSV(audit) { return rows(audit).map((r) => r.map(csvCell).join(',')).join('\r\n'); }
  function toJSON(audit) { return JSON.stringify(audit, null, 2); }

  function aggregateA11y(audit) {
    const map = new Map();
    for (const p of audit.pages) {
      if (!p.a11y) continue;
      for (const v of p.a11y.violations) {
        let e = map.get(v.id);
        if (!e) { e = { id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, description: v.description, tags: v.tags, nodes: 0, pages: [] }; map.set(v.id, e); }
        e.nodes += v.nodeCount;
        e.pages.push({ url: p.url, nodes: v.nodes, nodeCount: v.nodeCount });
      }
    }
    const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
    return Array.from(map.values()).sort((a, b) => (order[a.impact] - order[b.impact]) || (b.nodes - a.nodes));
  }

  function aggregateSeo(audit) {
    const map = new Map();
    for (const p of audit.pages) for (const s of p.seo) {
      let e = map.get(s.rule);
      if (!e) { e = { rule: s.rule, severity: s.severity, pages: [] }; map.set(s.rule, e); }
      e.pages.push({ url: p.url, message: s.message });
    }
    const order = { error: 0, warning: 1, info: 2 };
    return Array.from(map.values()).sort((a, b) => (order[a.severity] - order[b.severity]) || (b.pages.length - a.pages.length));
  }

  function toHTML(audit, brand) {
    const s = audit.summary;
    const a11y = aggregateA11y(audit);
    const seo = aggregateSeo(audit);
    const problems = audit.links.filter((l) => l.kind && l.kind !== 'ok').sort((a, b) => (a.kind === 'broken' ? -1 : 1) - (b.kind === 'broken' ? -1 : 1));
    const title = `Site audit — ${audit.origin}`;
    const by = brand && brand.name ? `Prepared by ${esc(brand.name)}` : 'Prepared with SiteSweep';
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
body{margin:0;padding:32px;font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#17202a;background:#fff;max-width:1000px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:32px 0 10px;padding-top:8px;border-top:2px solid #17202a}h3{font-size:15px;margin:18px 0 6px}
.meta{color:#5d6b78;margin-bottom:22px}.tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.tile{border:1px solid #dde3e8;border-radius:8px;padding:12px}
.tile .k{font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#5d6b78}.tile .v{font-size:28px;font-weight:800}.tile .s{font-size:12px;color:#5d6b78}
table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #dde3e8;vertical-align:top}th{font-size:11px;text-transform:uppercase;color:#5d6b78}
.pill{display:inline-block;padding:0 7px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;border:1px solid currentColor}
.critical,.error,.broken{color:#b3261e}.serious{color:#c2410c}.moderate,.warning,.redirect{color:#b45309}.minor,.info{color:#4b5563}
code{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all}.url{font-family:ui-monospace,Menlo,monospace;font-size:12px;word-break:break-all}
.muted{color:#5d6b78}.foot{margin-top:40px;color:#5d6b78;font-size:12px;border-top:1px solid #dde3e8;padding-top:10px}
@media print{body{padding:0}h2{break-before:page}h2:first-of-type{break-before:auto}}
</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">${by} · ${fmtDate(audit.startedAt)} · ${s.pages} pages crawled from <span class="url">${esc(audit.startUrl)}</span>${s.truncated ? ' · crawl stopped at the page limit' : ''}</div>
<div class="tiles">
<div class="tile"><div class="k">Pages</div><div class="v">${s.pages}</div><div class="s">${s.pagesError} unavailable</div></div>
<div class="tile"><div class="k">Accessibility issues</div><div class="v">${s.a11yTotal}</div><div class="s">${s.a11y.critical} critical · ${s.a11y.serious} serious · ${s.a11y.moderate} moderate · ${s.a11y.minor} minor</div></div>
<div class="tile"><div class="k">Broken links</div><div class="v">${s.links.broken + s.links.error}</div><div class="s">${s.links.redirect} redirects · ${s.links.checked} checked</div></div>
<div class="tile"><div class="k">SEO issues</div><div class="v">${s.seo.error + s.seo.warning}</div><div class="s">${s.seo.info} informational</div></div>
</div>

<h2>Accessibility</h2>
<p class="muted">Automated checks with axe-core ${esc((audit.pages.find((p) => p.a11y) || { a11y: {} }).a11y.engine || '')} on ${s.a11yPages} rendered pages. Automated tools find roughly a third to a half of WCAG issues; a manual review is still required for full conformance.</p>
${a11y.length === 0 ? '<p>No violations detected.</p>' : a11y.map((r) => `
<h3><span class="pill ${r.impact}">${r.impact}</span> ${esc(r.help)} <span class="muted">· ${r.nodes} element${r.nodes === 1 ? '' : 's'} on ${r.pages.length} page${r.pages.length === 1 ? '' : 's'}</span></h3>
<p>${esc(r.description)} ${r.tags.length ? '<span class="muted">(' + r.tags.map(esc).join(', ') + ')</span>' : ''} <a href="${esc(r.helpUrl)}">How to fix</a></p>
<table><tr><th>Page</th><th>Elements</th><th>Example</th></tr>${r.pages.slice(0, 40).map((p) => `<tr><td class="url">${esc(p.url)}</td><td>${p.nodeCount}</td><td><code>${esc((p.nodes[0] || {}).html || '')}</code></td></tr>`).join('')}</table>`).join('')}

<h2>Links</h2>
${problems.length === 0 ? '<p>No broken links or redirects among the checked links.</p>' : `<table><tr><th>Status</th><th>Link</th><th>Found on</th></tr>${problems.map((l) => `<tr><td><span class="pill ${l.kind}">${l.kind}</span> ${l.status || ''}</td><td class="url">${esc(l.url)}${l.kind === 'redirect' ? '<br><span class="muted">→ ' + esc(l.finalUrl) + '</span>' : ''}${l.error ? '<br><span class="muted">' + esc(l.error) + '</span>' : ''}</td><td class="url">${l.sources.slice(0, 5).map((x) => esc(x.page)).join('<br>')}${l.sources.length > 5 ? '<br><span class="muted">+' + (l.sources.length - 5) + ' more</span>' : ''}</td></tr>`).join('')}</table>`}

<h2>SEO</h2>
${seo.length === 0 ? '<p>No SEO issues detected.</p>' : seo.map((r) => `
<h3><span class="pill ${r.severity}">${r.severity}</span> ${esc(r.rule)} <span class="muted">· ${r.pages.length} page${r.pages.length === 1 ? '' : 's'}</span></h3>
<table><tr><th>Page</th><th>Detail</th></tr>${r.pages.slice(0, 60).map((p) => `<tr><td class="url">${esc(p.url)}</td><td>${esc(p.message)}</td></tr>`).join('')}</table>`).join('')}

<h2>Pages</h2>
<table><tr><th>Page</th><th>Status</th><th>Title</th><th>A11y</th><th>SEO</th></tr>${audit.pages.map((p) => `<tr><td class="url">${esc(p.url)}</td><td>${p.status || esc(p.error || 'error')}</td><td>${esc(p.title)}</td><td>${p.a11y ? Object.values(p.a11y.counts).reduce((a, b) => a + b, 0) : '—'}</td><td>${p.seo.length}</td></tr>`).join('')}</table>
<div class="foot">Generated ${fmtDate(Date.now())} · Accessibility rules © Deque Systems, axe-core (MPL-2.0) · Report produced by SiteSweep for Chrome</div>
</body></html>`;
  }

  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  }

  function baseName(audit) {
    const host = audit.origin.replace(/^https?:\/\//, '').replace(/[^a-z0-9.-]/gi, '_');
    return `sitesweep_${host}_${new Date(audit.startedAt).toISOString().slice(0, 10)}`;
  }

  return { toCSV, toJSON, toHTML, download, baseName, aggregateA11y, aggregateSeo, esc };
})();
