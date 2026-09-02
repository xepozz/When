'use strict';
// Server-rendered pages. Plain template functions; every dynamic value goes through esc(). Strings come from i18n.js.
const i18n = require('./i18n');
const legal = require('./legal');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = (x) => Number(x).toLocaleString('ru-RU').replace(/ /g, ' ');
const DOC_LANGS = ['curl', 'php', 'laravel', 'node', 'python', 'ruby', 'go'];
const T = (config) => i18n.get(config.siteLang);
const money = (config, cents) => {
  const v = cents / 100;
  if (config.currency === 'RUB') return n(v) + ' ₽';
  return '$' + (cents % 100 ? v.toFixed(2) : v.toFixed(0));
};

function layout({ config, user, title, description, body, wide }) {
  const t = T(config);
  const lang = config.siteLang === 'en' ? 'en' : 'ru';
  const fullTitle = title ? `${title} · ${config.appName}` : `${config.appName} — ${t.tagline}`;
  const legalLine = config.legal.name ? `<span>${esc(config.legal.name)}${config.legal.inn ? ', ИНН ' + esc(config.legal.inn) : ''}${config.legal.ogrn ? ', ОГРНИП ' + esc(config.legal.ogrn) : ''}</span>` : '';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description || t.meta_desc)}">
<meta property="og:title" content="${esc(fullTitle)}"><meta property="og:description" content="${esc(description || t.meta_desc)}"><meta property="og:image" content="${esc(config.appUrl)}/static/og.png"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/static/style.css"></head><body>
<header class="nav"><a class="brand" href="/">${esc(config.appName)}</a><nav>
<a href="/docs">${t.nav_docs}</a><a href="/pricing">${t.nav_pricing}</a><a href="/tools/html-to-pdf">${t.nav_tools}</a>
${user ? `<a href="/dashboard">${t.nav_dash}</a><form method="post" action="/logout" class="inline"><button class="link">${t.nav_logout}</button></form>` : `<a href="/login">${t.nav_login}</a><a class="btn small" href="/signup">${t.nav_signup}</a>`}
</nav></header>
<main class="${wide ? 'wide' : ''}">${body}</main>
<footer><span>© ${new Date().getFullYear()} ${esc(config.appName)}</span>${legalLine}${config.legal.email ? `<a href="mailto:${esc(config.legal.email)}">${esc(config.legal.email)}</a>` : ''}<a href="/docs">${t.foot_api}</a><a href="/pricing">${t.foot_pricing}</a><a href="/tools/html-to-pdf">${t.foot_pdf}</a><a href="/tools/screenshot">${t.foot_shot}</a><a href="/offer">${t.foot_offer}</a><a href="/privacy">${t.foot_privacy}</a><a href="/health">${t.foot_status}</a></footer>
</body></html>`;
}

function home({ config, user }) {
  const t = T(config);
  const curl = `curl -X POST ${config.appUrl}/v1/pdf \\
  -H "Authorization: Bearer rk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/invoice/42", "format": "A4"}' \\
  -o invoice.pdf`;
  return layout({ config, user, body: `
<section class="hero">
  <h1>${t.h1}</h1>
  <p class="lead">${t.lead}</p>
  <div class="cta"><a class="btn" href="/signup">${t.cta_key}</a><a class="btn ghost" href="/docs">${t.cta_docs}</a></div>
  <p class="fine">${t.fine_free(n(config.plans.free.monthly), money(config, config.plans.starter.priceCents))}</p>
</section>
<pre class="code"><code>${esc(curl)}</code></pre>
<section class="grid3">
  <div><h3>${t.f1_h}</h3><p>${t.f1}</p></div>
  <div><h3>${t.f2_h}</h3><p>${t.f2}</p></div>
  <div><h3>${t.f3_h}</h3><p>${t.f3}</p></div>
</section>
<section class="two">
  <div><h2>${t.two1_h}</h2><p>${t.two1}</p>
  <p><a href="/docs/php">PHP</a> · <a href="/docs/laravel">Laravel</a> · <a href="/docs/node">Node.js</a> · <a href="/docs/python">Python</a> · <a href="/docs/ruby">Ruby</a> · <a href="/docs/go">Go</a> · <a href="/docs">cURL</a></p></div>
  <div><h2>${t.two2_h}</h2><p>${t.two2(config.freeToolPerHour)}</p></div>
</section>
${pricingTable(config, user)}
` });
}

function pricingTable(config, user) {
  const t = T(config);
  const plans = Object.entries(config.plans);
  return `<section id="pricing"><h2>${t.pricing_h}</h2><div class="plans">${plans.map(([key, p]) => `
<div class="plan ${key === 'pro' ? 'featured' : ''}"><div class="pname">${esc(p.name)}</div><div class="price">${money(config, p.priceCents)}<small>${p.priceCents ? t.per_month : t.forever}</small></div>
<ul><li><b>${n(p.monthly)}</b> ${t.renders_mo}</li><li>${p.ratePerMin} ${t.req_min}</li><li>${t.concurrent(p.concurrency)}</li><li>${t.all_opts}</li>${key === 'free' ? `<li>${t.no_card}</li>` : `<li>${t.cancel_any}</li>`}</ul>
${key === 'free' ? `<a class="btn ghost" href="/signup">${t.start_free}</a>` : (user ? `<form method="post" action="/billing/checkout"><input type="hidden" name="plan" value="${key}"><button class="btn ${key === 'pro' ? '' : 'ghost'}">${t.choose(esc(p.name))}</button></form>` : `<a class="btn ${key === 'pro' ? '' : 'ghost'}" href="/signup">${t.choose(esc(p.name))}</a>`)}
</div>`).join('')}</div>
<p class="fine">${t.pricing_fine(n(config.plans.business.monthly))}</p></section>`;
}

function pricing({ config, user }) {
  const t = T(config);
  return layout({ config, user, title: t.pricing_h, body: pricingTable(config, user) + `
<section><h2>${t.faq_h}</h2>${t.faq.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join('')}</section>` });
}

const SNIPPETS = {
  curl: (u) => ({ title: 'cURL', code: `# PDF from a URL
curl -X POST ${u}/v1/pdf \\
  -H "Authorization: Bearer rk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://example.com","format":"A4","margin":"15mm"}' \\
  -o page.pdf

# PDF from your own HTML
curl -X POST ${u}/v1/pdf \\
  -H "Authorization: Bearer rk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"html":"<h1>Счёт №42</h1><p>Итого: 12 000 ₽</p>","format":"A4"}' \\
  -o invoice.pdf

# Full-page screenshot, retina, WebP
curl "${u}/v1/screenshot?url=https://example.com&full_page=1&device_scale_factor=2&format=webp" \\
  -H "Authorization: Bearer rk_live_YOUR_KEY" -o shot.webp` }),
  php: (u) => ({ title: 'PHP', code: `<?php
// composer require renderkit/renderkit  — или без зависимостей, на cURL:
function renderkit(string $endpoint, array $params, string $apiKey): string {
    $ch = curl_init('${u}/v1/' . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($params, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $body = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($status !== 200) {
        throw new RuntimeException('RenderKit error ' . $status . ': ' . $body);
    }
    return $body;
}

$html = $twig->render('invoice.html.twig', ['invoice' => $invoice]);
$pdf = renderkit('pdf', ['html' => $html, 'format' => 'A4', 'margin' => '12mm'], getenv('RENDERKIT_KEY'));
file_put_contents('invoice-42.pdf', $pdf);

// или сразу в браузер
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="invoice-42.pdf"');
echo $pdf;` }),
  laravel: (u) => ({ title: 'Laravel', code: `<?php
// config/services.php
'renderkit' => ['key' => env('RENDERKIT_KEY'), 'url' => '${u}'],

// app/Services/Pdf.php
namespace App\\Services;

use Illuminate\\Support\\Facades\\Http;

class Pdf
{
    public static function fromView(string $view, array $data, array $options = []): string
    {
        $response = Http::withToken(config('services.renderkit.key'))
            ->timeout(60)
            ->post(config('services.renderkit.url') . '/v1/pdf', [
                'html' => view($view, $data)->render(),
                'format' => 'A4',
                'margin' => '12mm',
                ...$options,
            ]);
        $response->throw();
        return $response->body();
    }
}

// в контроллере
return response(Pdf::fromView('invoices.show', ['invoice' => $invoice]), 200, [
    'Content-Type' => 'application/pdf',
    'Content-Disposition' => 'inline; filename="invoice-' . $invoice->number . '.pdf"',
]);` }),
  node: (u) => ({ title: 'Node.js', code: `// Node 18+ (встроенный fetch)
async function renderPdf(params) {
  const res = await fetch('${u}/v1/pdf', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.RENDERKIT_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(\`RenderKit \${res.status}: \${await res.text()}\`);
  return Buffer.from(await res.arrayBuffer());
}

const pdf = await renderPdf({ url: 'https://example.com/report/2026-08', format: 'A4', landscape: true,
  footer_template: '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
await fs.promises.writeFile('report.pdf', pdf);

// Express: отдать скриншот
app.get('/preview', async (req, res) => {
  const r = await fetch('${u}/v1/screenshot?url=' + encodeURIComponent(req.query.url) + '&width=1200&height=630', {
    headers: { Authorization: 'Bearer ' + process.env.RENDERKIT_KEY } });
  res.type('png').send(Buffer.from(await r.arrayBuffer()));
});` }),
  python: (u) => ({ title: 'Python', code: `import os, requests

def render_pdf(**params) -> bytes:
    r = requests.post("${u}/v1/pdf",
        headers={"Authorization": f"Bearer {os.environ['RENDERKIT_KEY']}"},
        json=params, timeout=60)
    r.raise_for_status()
    return r.content

pdf = render_pdf(html=render_template("invoice.html", invoice=inv), format="A4", margin="12mm")
open("invoice.pdf", "wb").write(pdf)

# Django view
from django.http import HttpResponse
def invoice_pdf(request, pk):
    html = render_to_string("invoice.html", {"invoice": Invoice.objects.get(pk=pk)})
    return HttpResponse(render_pdf(html=html), content_type="application/pdf")` }),
  ruby: (u) => ({ title: 'Ruby', code: `require "net/http"
require "json"

def render_pdf(params)
  uri = URI("${u}/v1/pdf")
  req = Net::HTTP::Post.new(uri, "Authorization" => "Bearer #{ENV.fetch('RENDERKIT_KEY')}", "Content-Type" => "application/json")
  req.body = params.to_json
  res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https", read_timeout: 60) { |http| http.request(req) }
  raise "RenderKit #{res.code}: #{res.body}" unless res.is_a?(Net::HTTPSuccess)
  res.body
end

# Rails controller
def show
  html = render_to_string(template: "invoices/show", layout: "pdf", formats: [:html])
  send_data render_pdf(html: html, format: "A4"), filename: "invoice-#{@invoice.number}.pdf", type: "application/pdf", disposition: "inline"
end` }),
  go: (u) => ({ title: 'Go', code: `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
)

func renderPDF(params map[string]any) ([]byte, error) {
	body, _ := json.Marshal(params)
	req, _ := http.NewRequest("POST", "${u}/v1/pdf", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+os.Getenv("RENDERKIT_KEY"))
	req.Header.Set("Content-Type", "application/json")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	if res.StatusCode != 200 {
		return nil, fmt.Errorf("renderkit %d: %s", res.StatusCode, out)
	}
	return out, nil
}

func main() {
	pdf, err := renderPDF(map[string]any{"url": "https://example.com", "format": "A4"})
	if err != nil {
		panic(err)
	}
	os.WriteFile("page.pdf", pdf, 0o644)
}` }),
};

function docs({ config, user, lang }) {
  const t = T(config);
  const u = config.appUrl;
  const s = SNIPPETS[lang](u);
  const row = (name, type, def, desc) => `<tr><td><code>${esc(name)}</code></td><td>${esc(type)}</td><td>${esc(def)}</td><td>${desc}</td></tr>`;
  const table = (rows) => `<div class="tablewrap"><table><thead><tr><th>${t.th_param}</th><th>${t.th_type}</th><th>${t.th_default}</th><th>${t.th_desc}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const P = t.p;
  return layout({ config, user, wide: true, title: `API · ${s.title}`, description: `${t.docs_h1}: ${s.title}. ${t.meta_desc}`, body: `
<h1>${t.docs_h1}</h1>
<p class="lead">${t.docs_lead}</p>
<nav class="tabs">${DOC_LANGS.map((l) => `<a class="${l === lang ? 'active' : ''}" href="${l === 'curl' ? '/docs' : '/docs/' + l}">${esc(SNIPPETS[l](u).title)}</a>`).join('')}</nav>
<pre class="code"><code>${esc(s.code)}</code></pre>

<h2 id="pdf">POST /v1/pdf</h2>
<p>${t.docs_pdf_p}</p>
${table(row('url', 'string', '—', P.url) + row('html', 'string', '—', P.html) + row('format', 'string', 'A4', P.format_pdf) + row('landscape', 'bool', 'false', P.landscape) + row('margin', 'string', '10mm', P.margin) + row('print_background', 'bool', 'true', P.print_background) + row('pdf_scale', 'number', '1', P.pdf_scale) + row('page_ranges', 'string', 'all', P.page_ranges) + row('header_template', 'string', '—', P.header_template) + row('footer_template', 'string', '—', P.footer_template) + row('prefer_css_page_size', 'bool', 'false', P.prefer_css_page_size) + row('media', 'string', 'print', P.media))}

<h2 id="screenshot">POST /v1/screenshot</h2>
<p>${t.docs_shot_p}</p>
${table(row('url / html', 'string', '—', P.url_html) + row('width', 'int', '1280', P.width) + row('height', 'int', '800', P.height) + row('full_page', 'bool', 'false', P.full_page) + row('format', 'string', 'png', P.format_shot) + row('quality', 'int', '80', P.quality) + row('device_scale_factor', 'number', '1', P.dsf) + row('selector', 'string', '—', P.selector) + row('clip', 'string', '—', P.clip) + row('transparent', 'bool', 'false', P.transparent))}

<h2 id="common">${t.docs_common_h}</h2>
${table(row('wait_until', 'string', 'load', P.wait_until) + row('wait_for', 'string', '—', P.wait_for) + row('delay', 'int', '0', P.delay) + row('timeout', 'int', '20000', P.timeout) + row('css', 'string', '—', P.css) + row('hide', 'string', '—', P.hide) + row('dark_mode', 'bool', 'false', P.dark_mode) + row('block_ads', 'bool', 'false', P.block_ads) + row('user_agent', 'string', 'Chrome', P.user_agent) + row('locale', 'string', '—', P.locale) + row('timezone', 'string', '—', P.timezone))}

<h2 id="errors">${t.docs_err_h}</h2>
<p>${t.docs_err_p}</p>
<div class="tablewrap"><table><thead><tr><th>${t.th_status}</th><th>${t.th_code}</th><th>${t.th_meaning}</th></tr></thead><tbody>${t.err_rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>

<h2 id="usage">${t.docs_usage_h}</h2>
<p>${t.docs_usage_p}</p>
<p><a href="/openapi.json">OpenAPI 3.0</a> · <a href="/llms.txt">llms.txt</a></p>

<h2 id="tips">${t.docs_tips_h}</h2>
<ul>${t.docs_tips.map((x) => `<li>${x}</li>`).join('')}</ul>
` });
}

const authForm = (kind, { config, error, email }) => {
  const t = T(config);
  return `
<section class="narrow">
<h1>${kind === 'signup' ? t.signup_h : t.login_h}</h1>
${kind === 'signup' ? `<p class="lead">${t.signup_lead(n(config.plans.free.monthly))}</p>` : ''}
${error ? `<div class="alert">${esc(error)}</div>` : ''}
<form method="post" action="/${kind}" class="form">
<label>${t.email}<input type="email" name="email" required autocomplete="email" value="${esc(email || '')}"></label>
<label>${t.password}<input type="password" name="password" required minlength="8" autocomplete="${kind === 'signup' ? 'new-password' : 'current-password'}"></label>
<button class="btn">${kind === 'signup' ? t.signup_btn : t.login_btn}</button>
</form>
<p class="fine">${kind === 'signup' ? t.have_account : t.new_here}</p>
</section>`;
};
const signup = (ctx) => layout({ ...ctx, title: T(ctx.config).signup_h, body: authForm('signup', ctx) });
const login = (ctx) => layout({ ...ctx, title: T(ctx.config).login_h, body: authForm('login', ctx) });

function dashboard({ config, user, plan, used, keys, recent, series, newKey, upgraded, canceled, error, billingReady, provider, payments = [] }) {
  const t = T(config);
  const pct = Math.min(100, Math.round((used / plan.monthly) * 100));
  const max = Math.max(1, ...series.map((r) => r.n));
  const date = (ts) => new Date(ts).toISOString().slice(0, 10);
  let billing = '';
  if (user.plan === 'free') billing = `<a class="btn small" href="/pricing">${t.upgrade}</a>`;
  else if (provider === 'yookassa') {
    billing = `<div class="fine">${t.paid_until} ${user.paid_until ? date(user.paid_until) : '—'} · ${user.payment_method_id ? t.autopay_on : t.autopay_off}</div>
      <div class="row-btns">${user.payment_method_id ? `<form method="post" action="/billing/cancel"><button class="btn small ghost">${t.cancel_auto}</button></form>` : `<form method="post" action="/billing/checkout"><input type="hidden" name="plan" value="${esc(user.plan)}"><button class="btn small">${t.renew}</button></form>`}<a class="btn small ghost" href="/pricing">${t.upgrade}</a></div>`;
  } else if (billingReady) billing = `<form method="post" action="/billing/portal"><button class="btn small ghost">${t.manage}</button></form>`;
  return layout({ config, user, wide: true, title: t.dash_h, body: `
<h1>${t.dash_h}</h1>
${upgraded ? `<div class="alert ok">${t.dash_upgraded}</div>` : ''}
${canceled ? `<div class="alert ok">${t.dash_canceled}</div>` : ''}
${error ? `<div class="alert">${esc(error)}</div>` : ''}
${newKey ? `<div class="alert ok"><b>${t.dash_newkey}</b><pre class="code"><code>${esc(newKey)}</code></pre></div>` : ''}
<div class="cards">
  <div class="card"><div class="k">${t.plan}</div><div class="v">${esc(plan.name)}</div>${billing}</div>
  <div class="card"><div class="k">${t.renders_month}</div><div class="v">${n(used)} <small>/ ${n(plan.monthly)}</small></div><div class="bar"><div style="width:${pct}%"></div></div></div>
  <div class="card"><div class="k">${t.rate_limit}</div><div class="v">${plan.ratePerMin}<small>/min</small></div><div class="fine">${plan.concurrency} ${t.concurrent_short}</div></div>
</div>

<h2>${t.keys_h}</h2>
<table class="table"><thead><tr><th>${t.k_name}</th><th>${t.k_key}</th><th>${t.k_created}</th><th></th></tr></thead><tbody>
${keys.map((k) => `<tr><td>${esc(k.name)}</td><td><code>${esc(k.prefix)}…</code></td><td>${date(k.created_at)}</td><td><form method="post" action="/dashboard/keys/${k.id}/revoke" onsubmit="return confirm('${t.revoke_confirm}')"><button class="link danger">${t.revoke}</button></form></td></tr>`).join('')}
</tbody></table>
<form method="post" action="/dashboard/keys" class="inline-form"><input name="name" placeholder="${t.key_placeholder}" maxlength="40"><button class="btn small ghost">${t.create_key}</button></form>

<h2>${t.last30}</h2>
<div class="chart">${series.length ? series.map((r) => `<div class="col" title="${esc(r.day)}: ${r.n}"><div style="height:${Math.round((r.n / max) * 100)}%"></div><span>${r.day.slice(5)}</span></div>`).join('') : `<p class="fine">${t.no_renders}</p>`}</div>

<h2>${t.recent_h}</h2>
<table class="table"><thead><tr><th>${t.r_when}</th><th>${t.r_type}</th><th>${t.r_source}</th><th>${t.r_result}</th><th>ms</th><th>KB</th></tr></thead><tbody>
${recent.length ? recent.map((r) => `<tr><td>${new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td><td>${esc(r.kind)}</td><td class="src">${esc(r.source)}</td><td>${r.ok ? `<span class="ok">${t.ok}</span>` : `<span class="bad" title="${esc(r.error || '')}">${t.failed}</span>`}</td><td>${r.ms}</td><td>${(r.bytes / 1024).toFixed(0)}</td></tr>`).join('') : `<tr><td colspan="6" class="fine">${t.nothing_yet} <code>curl -H "Authorization: Bearer YOUR_KEY" "${esc(config.appUrl)}/v1/screenshot?url=https://example.com" -o shot.png</code></td></tr>`}
</tbody></table>
${payments.length ? `<h2>${t.payments_h}</h2>
<table class="table"><thead><tr><th>${t.pay_date}</th><th>${t.pay_plan}</th><th>${t.pay_amount}</th><th>${t.pay_kind}</th><th>${t.pay_status}</th><th>ID</th></tr></thead><tbody>
${payments.map((p) => `<tr><td>${date(p.created_at)}</td><td>${esc(config.plans[p.plan] ? config.plans[p.plan].name : p.plan)}</td><td>${money({ currency: p.currency }, p.amount)}</td><td>${p.kind === 'renewal' ? t.kind_renewal : t.kind_initial}</td><td>${esc(p.status)}</td><td><code>${esc(p.id)}</code></td></tr>`).join('')}
</tbody></table>` : ''}
` });
}

function toolPdf({ config, user, error, values = {} }) {
  const t = T(config);
  return layout({ config, user, title: t.tool_pdf_title, description: t.tool_pdf_desc, body: `
<section class="narrow"><h1>${t.tool_pdf_h}</h1><p class="lead">${t.tool_pdf_lead(config.freeToolPerHour)}</p>
${error ? `<div class="alert">${esc(error)}</div>` : ''}
<form method="post" action="/tools/html-to-pdf" class="form">
<label>URL<input type="url" name="url" placeholder="https://example.com/invoice" value="${esc(values.url || '')}"></label>
<div class="or">${t.or}</div>
<label>HTML<textarea name="html" rows="8" placeholder="&lt;h1&gt;Счёт №42&lt;/h1&gt;">${esc(values.html || '')}</textarea></label>
<div class="row"><label>${t.paper}<select name="format">${['A4', 'Letter', 'Legal', 'A3', 'A5'].map((f) => `<option ${values.format === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
<label>${t.margin_l}<input name="margin" value="${esc(values.margin || '10mm')}"></label>
<label class="check"><input type="checkbox" name="landscape" value="1" ${values.landscape ? 'checked' : ''}> ${t.landscape_l}</label>
<label class="check"><input type="checkbox" name="download" value="1" ${values.download ? 'checked' : ''}> ${t.download_l}</label></div>
<button class="btn">${t.convert}</button></form>
<p class="fine">${t.tool_fine(money(config, config.plans.starter.priceCents))}</p></section>` });
}

function toolShot({ config, user, error, values = {} }) {
  const t = T(config);
  return layout({ config, user, title: t.tool_shot_title, description: t.tool_shot_desc, body: `
<section class="narrow"><h1>${t.tool_shot_h}</h1><p class="lead">${t.tool_shot_lead(config.freeToolPerHour)}</p>
${error ? `<div class="alert">${esc(error)}</div>` : ''}
<form method="post" action="/tools/screenshot" class="form">
<label>URL<input type="url" name="url" required placeholder="https://example.com" value="${esc(values.url || '')}"></label>
<div class="row"><label>${t.width_l}<input name="width" type="number" min="320" max="1920" value="${esc(values.width || 1280)}"></label>
<label>${t.height_l}<input name="height" type="number" min="200" max="1080" value="${esc(values.height || 800)}"></label>
<label>${t.format_l}<select name="format">${['png', 'jpeg', 'webp'].map((f) => `<option ${values.format === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
<label class="check"><input type="checkbox" name="full_page" value="1" ${values.full_page ? 'checked' : ''}> ${t.full_page_l}</label>
<label class="check"><input type="checkbox" name="dark_mode" value="1" ${values.dark_mode ? 'checked' : ''}> ${t.dark_l}</label>
<label class="check"><input type="checkbox" name="download" value="1" ${values.download ? 'checked' : ''}> ${t.download_l}</label></div>
<button class="btn">${t.take_shot}</button></form></section>` });
}

function paddleCheckout({ config, user, plan, priceId }) {
  const t = T(config);
  const p = config.plans[plan];
  return layout({ config, user, title: t.checkout_h(p.name), body: `
<section class="narrow"><h1>${t.checkout_h(esc(p.name))}</h1><p class="lead">${money(config, p.priceCents)}${t.per_month} · ${n(p.monthly)} ${t.renders_mo}. ${t.checkout_lead}</p>
<p class="fine">${t.checkout_fine}</p></section>
<script src="https://cdn.paddle.com/paddle/v2/paddle.js"></script>
<script>
(function(){
  ${config.paddle.env === 'sandbox' ? "Paddle.Environment.set('sandbox');" : ''}
  Paddle.Initialize({ token: ${JSON.stringify(config.paddle.clientToken)}, eventCallback: function (ev) { if (ev.name === 'checkout.completed') { setTimeout(function(){ location.href = '/dashboard?upgraded=1'; }, 1500); } } });
  function open(){ Paddle.Checkout.open({ items: [{ priceId: ${JSON.stringify(priceId)}, quantity: 1 }], customer: { email: ${JSON.stringify(user.email)} }, customData: { user_id: ${JSON.stringify(String(user.id))}, plan: ${JSON.stringify(plan)} }, settings: { successUrl: ${JSON.stringify(config.appUrl + '/dashboard?upgraded=1')} } }); }
  document.getElementById('open').addEventListener('click', function(e){ e.preventDefault(); open(); });
  open();
})();
</script>` });
}

const legalPage = (kind) => ({ config, user }) => {
  const t = T(config);
  return layout({ config, user, title: kind === 'offer' ? t.offer_h : t.privacy_h, body: `<section class="prose">${legal[kind](config)}</section>` });
};

const error = ({ config, status, message }) => {
  const t = T(config);
  const msg = status === 404 ? t.err_404 : status === 403 ? t.err_403 : status >= 500 ? t.err_500 : message;
  return layout({ config, title: String(status), body: `<section class="narrow"><h1>${esc(status)}</h1><p class="lead">${esc(msg)}</p><p><a href="/">${t.err_back}</a></p></section>` });
};

module.exports = { layout, home, pricing, docs, signup, login, dashboard, toolPdf, toolShot, paddleCheckout, offer: legalPage('offer'), privacy: legalPage('privacy'), error, esc, DOC_LANGS, t: T, money };
