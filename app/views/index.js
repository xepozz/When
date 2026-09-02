'use strict';
// Server-rendered pages. Plain template functions; every dynamic value goes through esc().
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (cents) => (cents === 0 ? '$0' : '$' + (cents / 100).toFixed(cents % 100 ? 2 : 0));
const n = (x) => Number(x).toLocaleString('en-US');
const DOC_LANGS = ['curl', 'php', 'laravel', 'node', 'python', 'ruby', 'go'];

function layout({ config, user, title, description, body, wide }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title ? title + ' · ' + config.appName : config.appName + ' — HTML to PDF and screenshot API')}</title>
<meta name="description" content="${esc(description || 'Turn any URL or HTML into a pixel-perfect PDF or screenshot with one HTTP request. Headless Chrome, simple pricing, free plan.')}">
<meta property="og:title" content="${esc(title ? title + ' · ' + config.appName : config.appName + ' — HTML to PDF and screenshot API')}"><meta property="og:description" content="${esc(description || 'Turn any URL or HTML into a pixel-perfect PDF or screenshot with one HTTP request.')}"><meta property="og:image" content="${esc(config.appUrl)}/static/og.png"><meta property="og:type" content="website"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/static/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/static/style.css"></head><body>
<header class="nav"><a class="brand" href="/">${esc(config.appName)}</a><nav>
<a href="/docs">Docs</a><a href="/pricing">Pricing</a><a href="/tools/html-to-pdf">Free tools</a>
${user ? `<a href="/dashboard">Dashboard</a><form method="post" action="/logout" class="inline"><button class="link">Log out</button></form>` : `<a href="/login">Log in</a><a class="btn small" href="/signup">Get API key</a>`}
</nav></header>
<main class="${wide ? 'wide' : ''}">${body}</main>
<footer><span>© ${new Date().getFullYear()} ${esc(config.appName)}</span><a href="/docs">API reference</a><a href="/pricing">Pricing</a><a href="/tools/html-to-pdf">HTML to PDF</a><a href="/tools/screenshot">Screenshot tool</a><a href="/health">Status</a></footer>
</body></html>`;
}

function home({ config, user }) {
  const curl = `curl -X POST ${config.appUrl}/v1/pdf \\
  -H "Authorization: Bearer rk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/invoice/42", "format": "A4"}' \\
  -o invoice.pdf`;
  return layout({ config, user, body: `
<section class="hero">
  <h1>PDFs and screenshots from any URL or HTML. One request.</h1>
  <p class="lead">Headless Chrome behind a plain HTTP API. Invoices, reports, certificates, link previews, dashboards to PDF, page snapshots for monitoring. No browser fleet to run, no wkhtmltopdf to babysit.</p>
  <div class="cta"><a class="btn" href="/signup">Get a free API key</a><a class="btn ghost" href="/docs">Read the docs</a></div>
  <p class="fine">Free plan: 100 renders a month, no card. Paid plans from ${money(config.plans.starter.priceCents)}/month.</p>
</section>
<pre class="code"><code>${esc(curl)}</code></pre>
<section class="grid3">
  <div><h3>Real Chrome rendering</h3><p>Flexbox, grid, web fonts, JavaScript charts, CSS page rules. If it renders in Chrome, it renders here. Choose print or screen media, light or dark scheme.</p></div>
  <div><h3>Every option you actually need</h3><p>Paper size, margins, landscape, headers and footers with page numbers, page ranges, full-page and element screenshots, retina scale, JPEG/WebP/PNG, wait for a selector, inject CSS, hide elements.</p></div>
  <div><h3>Private by design</h3><p>Nothing is stored. Each render runs in a fresh isolated browser context that is destroyed afterwards. Requests into private networks are blocked.</p></div>
</section>
<section class="two">
  <div><h2>Built for the invoice-at-2am problem</h2><p>Every product eventually needs a PDF. The library route ends with a broken layout on a customer's invoice and a server that runs out of memory. This is the same Chrome engine your designers already test against, with a queue, timeouts and a quota in front of it.</p>
  <p><a href="/docs/php">PHP</a> · <a href="/docs/laravel">Laravel</a> · <a href="/docs/node">Node.js</a> · <a href="/docs/python">Python</a> · <a href="/docs/ruby">Ruby</a> · <a href="/docs/go">Go</a> · <a href="/docs">cURL</a></p></div>
  <div><h2>Try it without an account</h2><p><a href="/tools/html-to-pdf">HTML to PDF</a> and <a href="/tools/screenshot">website screenshot</a> run on the same engine, ${config.freeToolPerHour} renders an hour, no signup.</p></div>
</section>
${pricingTable(config, user)}
` });
}

function pricingTable(config, user) {
  const plans = Object.entries(config.plans);
  return `<section id="pricing"><h2>Pricing</h2><div class="plans">${plans.map(([key, p]) => `
<div class="plan ${key === 'pro' ? 'featured' : ''}"><div class="pname">${esc(p.name)}</div><div class="price">${money(p.priceCents)}<small>${p.priceCents ? '/month' : ' forever'}</small></div>
<ul><li><b>${n(p.monthly)}</b> renders / month</li><li>${p.ratePerMin} requests / minute</li><li>${p.concurrency} concurrent render${p.concurrency > 1 ? 's' : ''}</li><li>PDF + screenshots, all options</li>${key === 'free' ? '<li>No card required</li>' : '<li>Cancel any time</li>'}</ul>
${key === 'free' ? `<a class="btn ghost" href="/signup">Start free</a>` : (user ? `<form method="post" action="/billing/checkout"><input type="hidden" name="plan" value="${key}"><button class="btn ${key === 'pro' ? '' : 'ghost'}">Choose ${esc(p.name)}</button></form>` : `<a class="btn ${key === 'pro' ? '' : 'ghost'}" href="/signup">Choose ${esc(p.name)}</a>`)}
</div>`).join('')}</div>
<p class="fine">A render is one successful PDF or screenshot. Failed renders are not counted. Quotas reset on the first of each month (UTC). Need more than ${n(config.plans.business.monthly)}? Email us for volume pricing.</p></section>`;
}

function pricing({ config, user }) {
  return layout({ config, user, title: 'Pricing', description: 'Simple monthly plans for the RenderKit PDF and screenshot API. Free plan with 100 renders, paid from $9.', body: pricingTable(config, user) + `
<section><h2>Questions</h2>
<h3>What counts as a render?</h3><p>One successful response from <code>/v1/pdf</code> or <code>/v1/screenshot</code>. Errors, timeouts and rate-limited requests are free.</p>
<h3>How fast is it?</h3><p>A typical invoice from HTML renders in 300–900 ms. Public URLs depend on the page: the render waits for the page's own load event plus whatever you ask for.</p>
<h3>Can I use it from the browser in an &lt;img&gt; tag?</h3><p>Yes, <code>GET /v1/screenshot?url=…&api_key=…</code> works, but the key is visible to whoever sees the page. Prefer proxying through your backend.</p>
<h3>Do you store my documents?</h3><p>No. The render is streamed back to you and the browser context is destroyed. We keep a log line with the URL or "html", status and timing so you can debug from the dashboard.</p>
</section>` });
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
  -d '{"html":"<h1>Invoice #42</h1><p>Total: $120</p>","format":"Letter"}' \\
  -o invoice.pdf

# Full-page screenshot, retina, WebP
curl "${u}/v1/screenshot?url=https://example.com&full_page=1&device_scale_factor=2&format=webp" \\
  -H "Authorization: Bearer rk_live_YOUR_KEY" -o shot.webp` }),
  php: (u) => ({ title: 'PHP', code: `<?php
// composer not required: plain cURL
function renderkit(string $endpoint, array $params, string $apiKey): string {
    $ch = curl_init('${u}/v1/' . $endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $apiKey, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($params),
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

// or send it straight to the browser
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

// in a controller
return response(Pdf::fromView('invoices.show', ['invoice' => $invoice]), 200, [
    'Content-Type' => 'application/pdf',
    'Content-Disposition' => 'inline; filename="invoice-' . $invoice->number . '.pdf"',
]);` }),
  node: (u) => ({ title: 'Node.js', code: `// Node 18+ (built-in fetch)
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

// Express: stream a screenshot
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
  const u = config.appUrl;
  const s = SNIPPETS[lang](u);
  const row = (name, type, def, desc) => `<tr><td><code>${esc(name)}</code></td><td>${esc(type)}</td><td>${esc(def)}</td><td>${desc}</td></tr>`;
  return layout({ config, user, wide: true, title: `API docs for ${s.title}`, description: `Generate PDFs and screenshots from ${s.title} with the RenderKit API. Full option reference and copy-paste examples.`, body: `
<h1>API reference</h1>
<p class="lead">Two endpoints, JSON in, bytes out. Authenticate with <code>Authorization: Bearer rk_live_…</code>. Get a key on the <a href="/signup">signup page</a>; it takes ten seconds.</p>
<nav class="tabs">${DOC_LANGS.map((l) => `<a class="${l === lang ? 'active' : ''}" href="${l === 'curl' ? '/docs' : '/docs/' + l}">${esc(SNIPPETS[l](u).title)}</a>`).join('')}</nav>
<pre class="code"><code>${esc(s.code)}</code></pre>

<h2 id="pdf">POST /v1/pdf</h2>
<p>Also accepts <code>GET /v1/pdf?url=…</code> with the same parameters as query strings. Returns <code>application/pdf</code>. Add <code>response=json</code> to receive <code>{"data": "&lt;base64&gt;", "content_type", "bytes", "ms"}</code> instead.</p>
<div class="tablewrap"><table><thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>
${row('url', 'string', '—', 'Public http(s) URL to render. Either <code>url</code> or <code>html</code>.')}
${row('html', 'string', '—', 'Raw HTML to render (up to 2 MB). Reference external CSS/images with absolute URLs or inline them.')}
${row('format', 'string', 'A4', 'Paper size: A0–A6, Letter, Legal, Tabloid, Ledger.')}
${row('landscape', 'bool', 'false', 'Landscape orientation.')}
${row('margin', 'string', '10mm', 'All four margins, any CSS length: <code>0</code>, <code>15mm</code>, <code>0.5in</code>.')}
${row('print_background', 'bool', 'true', 'Print background colours and images.')}
${row('pdf_scale', 'number', '1', 'Scale of the rendering, 0.1–2.')}
${row('page_ranges', 'string', 'all', 'Pages to include, e.g. <code>1-3,5</code>.')}
${row('header_template', 'string', '—', 'HTML for the header. Use classes <code>pageNumber</code>, <code>totalPages</code>, <code>date</code>, <code>title</code>, <code>url</code> in spans. Set an explicit font-size; margins must leave room.')}
${row('footer_template', 'string', '—', 'Same as header, at the bottom.')}
${row('prefer_css_page_size', 'bool', 'false', 'Let <code>@page { size }</code> in your CSS win over <code>format</code>.')}
${row('media', 'string', 'print', '<code>print</code> or <code>screen</code> media type for CSS.')}
</tbody></table></div>

<h2 id="screenshot">POST /v1/screenshot</h2>
<p>Also accepts <code>GET /v1/screenshot?url=…&amp;api_key=…</code>, handy for <code>&lt;img src&gt;</code>. Returns <code>image/png</code>, <code>image/jpeg</code> or <code>image/webp</code>.</p>
<div class="tablewrap"><table><thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>
${row('url / html', 'string', '—', 'As above.')}
${row('width', 'int', '1280', 'Viewport width, 100–4000.')}
${row('height', 'int', '800', 'Viewport height, 100–4000.')}
${row('full_page', 'bool', 'false', 'Capture the whole scrollable page.')}
${row('format', 'string', 'png', '<code>png</code>, <code>jpeg</code> or <code>webp</code>.')}
${row('quality', 'int', '80', 'JPEG/WebP quality 1–100.')}
${row('device_scale_factor', 'number', '1', '1–3. Use 2 for retina.')}
${row('selector', 'string', '—', 'CSS selector; screenshot only that element.')}
${row('clip', 'string', '—', '<code>x,y,width,height</code> in CSS pixels.')}
${row('transparent', 'bool', 'false', 'Omit the default white background (PNG/WebP).')}
</tbody></table></div>

<h2 id="common">Options for both</h2>
<div class="tablewrap"><table><thead><tr><th>Parameter</th><th>Type</th><th>Default</th><th>Description</th></tr></thead><tbody>
${row('wait_until', 'string', 'load', 'When the page counts as loaded: <code>load</code>, <code>domcontentloaded</code>, <code>networkidle</code>, <code>commit</code>.')}
${row('wait_for', 'string', '—', 'CSS selector to wait for before rendering (charts, fonts, lazy content).')}
${row('delay', 'int', '0', 'Extra milliseconds to wait after load, up to 10000.')}
${row('timeout', 'int', '20000', 'Navigation timeout in ms, up to 30000.')}
${row('css', 'string', '—', 'CSS injected before rendering, e.g. <code>.cookie-banner{display:none}</code>.')}
${row('hide', 'string', '—', 'CSS selector list to hide, e.g. <code>#chat, .popup</code>.')}
${row('dark_mode', 'bool', 'false', 'Emulate <code>prefers-color-scheme: dark</code>.')}
${row('block_ads', 'bool', 'false', 'Block common ad and tracking hosts.')}
${row('user_agent', 'string', 'Chrome', 'Custom User-Agent header.')}
${row('locale', 'string', '—', 'e.g. <code>de-DE</code>; affects number/date formatting in the page.')}
${row('timezone', 'string', '—', 'e.g. <code>Europe/Berlin</code>.')}
</tbody></table></div>

<h2 id="errors">Responses and errors</h2>
<p>Success is <code>200</code> with the file and headers <code>X-RenderKit-Time</code> (ms) and <code>X-RenderKit-Usage</code> (<code>used/limit</code> this month). Errors are JSON: <code>{"error": {"code", "message"}}</code>.</p>
<div class="tablewrap"><table><thead><tr><th>Status</th><th>Code</th><th>Meaning</th></tr></thead><tbody>
<tr><td>400</td><td>—</td><td>Invalid parameter; the message says which.</td></tr>
<tr><td>401</td><td>unauthorized</td><td>Missing or revoked API key.</td></tr>
<tr><td>402</td><td>quota_exceeded</td><td>Monthly renders used up. Upgrade on <a href="/pricing">pricing</a>.</td></tr>
<tr><td>422</td><td>render_failed</td><td>The page could not be loaded or rendered (DNS, 4xx/5xx from the target, blocked private host, selector not found).</td></tr>
<tr><td>429</td><td>rate_limited</td><td>Per-minute limit of your plan exceeded. Retry after a second.</td></tr>
<tr><td>503 / 504</td><td>—</td><td>Queue full or render timed out. Retry with backoff.</td></tr>
</tbody></table></div>

<h2 id="usage">GET /v1/usage</h2>
<p>Returns <code>{"plan", "used", "limit", "period"}</code> for the current month.</p>

<h2 id="tips">Tips for good PDFs</h2>
<ul>
<li>Set <code>@page { size: A4; margin: 0 }</code> in CSS together with <code>prefer_css_page_size=true</code> for full control.</li>
<li>Use <code>break-inside: avoid</code> on table rows and cards; <code>break-before: page</code> for chapter starts.</li>
<li>Web fonts: link them with absolute URLs, or wait for them with <code>wait_until=networkidle</code>.</li>
<li>Charts drawn by JavaScript: add a class when drawing finishes and pass it as <code>wait_for</code>.</li>
</ul>
` });
}

const authForm = (kind, { config, error, email }) => `
<section class="narrow">
<h1>${kind === 'signup' ? 'Create your API key' : 'Log in'}</h1>
${kind === 'signup' ? `<p class="lead">Free plan: ${n(config.plans.free.monthly)} renders a month. No card.</p>` : ''}
${error ? `<div class="alert">${esc(error)}</div>` : ''}
<form method="post" action="/${kind}" class="form">
<label>Email<input type="email" name="email" required autocomplete="email" value="${esc(email || '')}"></label>
<label>Password<input type="password" name="password" required minlength="8" autocomplete="${kind === 'signup' ? 'new-password' : 'current-password'}"></label>
<button class="btn">${kind === 'signup' ? 'Create account and key' : 'Log in'}</button>
</form>
<p class="fine">${kind === 'signup' ? 'Already have an account? <a href="/login">Log in</a>.' : 'New here? <a href="/signup">Create an account</a>.'}</p>
</section>`;
const signup = (ctx) => layout({ ...ctx, title: 'Sign up', body: authForm('signup', ctx) });
const login = (ctx) => layout({ ...ctx, title: 'Log in', body: authForm('login', ctx) });

function dashboard({ config, user, plan, used, keys, recent, series, newKey, upgraded, error, billingReady }) {
  const pct = Math.min(100, Math.round((used / plan.monthly) * 100));
  const max = Math.max(1, ...series.map((r) => r.n));
  return layout({ config, user, wide: true, title: 'Dashboard', body: `
<h1>Dashboard</h1>
${upgraded ? `<div class="alert ok">Payment received. Your plan updates within a few seconds once Stripe confirms it; reload if it still shows the old plan.</div>` : ''}
${error ? `<div class="alert">${esc(error)}</div>` : ''}
${newKey ? `<div class="alert ok"><b>Your new API key. Copy it now; it is shown only once.</b><pre class="code"><code>${esc(newKey)}</code></pre></div>` : ''}
<div class="cards">
  <div class="card"><div class="k">Plan</div><div class="v">${esc(plan.name)}</div>
    ${user.plan === 'free' ? `<a class="btn small" href="/pricing">Upgrade</a>` : (billingReady ? `<form method="post" action="/billing/portal"><button class="btn small ghost">Manage subscription</button></form>` : '')}</div>
  <div class="card"><div class="k">Renders this month</div><div class="v">${n(used)} <small>/ ${n(plan.monthly)}</small></div><div class="bar"><div style="width:${pct}%"></div></div></div>
  <div class="card"><div class="k">Rate limit</div><div class="v">${plan.ratePerMin}<small>/min</small></div><div class="fine">${plan.concurrency} concurrent</div></div>
</div>

<h2>API keys</h2>
<table class="table"><thead><tr><th>Name</th><th>Key</th><th>Created</th><th></th></tr></thead><tbody>
${keys.map((k) => `<tr><td>${esc(k.name)}</td><td><code>${esc(k.prefix)}…</code></td><td>${new Date(k.created_at).toISOString().slice(0, 10)}</td><td><form method="post" action="/dashboard/keys/${k.id}/revoke" onsubmit="return confirm('Revoke this key?')"><button class="link danger">Revoke</button></form></td></tr>`).join('')}
</tbody></table>
<form method="post" action="/dashboard/keys" class="inline-form"><input name="name" placeholder="Key name (e.g. production)" maxlength="40"><button class="btn small ghost">Create key</button></form>

<h2>Last 30 days</h2>
<div class="chart">${series.length ? series.map((r) => `<div class="col" title="${esc(r.day)}: ${r.n}"><div style="height:${Math.round((r.n / max) * 100)}%"></div><span>${r.day.slice(5)}</span></div>`).join('') : '<p class="fine">No renders yet. Your first request will show up here.</p>'}</div>

<h2>Recent renders</h2>
<table class="table"><thead><tr><th>When</th><th>Type</th><th>Source</th><th>Result</th><th>ms</th><th>KB</th></tr></thead><tbody>
${recent.length ? recent.map((r) => `<tr><td>${new Date(r.created_at).toISOString().replace('T', ' ').slice(0, 19)}</td><td>${esc(r.kind)}</td><td class="src">${esc(r.source)}</td><td>${r.ok ? '<span class="ok">ok</span>' : `<span class="bad" title="${esc(r.error || '')}">failed</span>`}</td><td>${r.ms}</td><td>${(r.bytes / 1024).toFixed(0)}</td></tr>`).join('') : '<tr><td colspan="6" class="fine">Nothing yet. Try: <code>curl -H "Authorization: Bearer YOUR_KEY" "' + esc(config.appUrl) + '/v1/screenshot?url=https://example.com" -o shot.png</code></td></tr>'}
</tbody></table>
` });
}

function toolPdf({ config, user, error, values = {} }) {
  return layout({ config, user, title: 'Free HTML to PDF converter', description: 'Convert HTML or any web page to PDF online, free, with real Chrome rendering. Paper size, margins, landscape.', body: `
<section class="narrow"><h1>HTML to PDF, free</h1><p class="lead">Paste HTML or a URL. Rendered by headless Chrome, the same engine behind the <a href="/docs">API</a>. ${config.freeToolPerHour} renders an hour without an account.</p>
${error ? `<div class="alert">${esc(error)}</div>` : ''}
<form method="post" action="/tools/html-to-pdf" class="form">
<label>URL<input type="url" name="url" placeholder="https://example.com/invoice" value="${esc(values.url || '')}"></label>
<div class="or">or</div>
<label>HTML<textarea name="html" rows="8" placeholder="&lt;h1&gt;Invoice #42&lt;/h1&gt;">${esc(values.html || '')}</textarea></label>
<div class="row"><label>Paper<select name="format">${['A4', 'Letter', 'Legal', 'A3', 'A5'].map((f) => `<option ${values.format === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
<label>Margin<input name="margin" value="${esc(values.margin || '10mm')}"></label>
<label class="check"><input type="checkbox" name="landscape" value="1" ${values.landscape ? 'checked' : ''}> Landscape</label>
<label class="check"><input type="checkbox" name="download" value="1" ${values.download ? 'checked' : ''}> Download instead of opening</label></div>
<button class="btn">Convert to PDF</button></form>
<p class="fine">Need this in your app? <a href="/signup">Get an API key</a>: 100 renders a month free, then from ${money(config.plans.starter.priceCents)}/month.</p></section>` });
}

function toolShot({ config, user, error, values = {} }) {
  return layout({ config, user, title: 'Free website screenshot tool', description: 'Take a full-page screenshot of any website online, free. PNG, JPEG or WebP, retina, custom viewport.', body: `
<section class="narrow"><h1>Website screenshot, free</h1><p class="lead">Any public URL, rendered in headless Chrome. ${config.freeToolPerHour} screenshots an hour without an account; the <a href="/docs">API</a> does the same from your code.</p>
${error ? `<div class="alert">${esc(error)}</div>` : ''}
<form method="post" action="/tools/screenshot" class="form">
<label>URL<input type="url" name="url" required placeholder="https://example.com" value="${esc(values.url || '')}"></label>
<div class="row"><label>Width<input name="width" type="number" min="320" max="1920" value="${esc(values.width || 1280)}"></label>
<label>Height<input name="height" type="number" min="200" max="1080" value="${esc(values.height || 800)}"></label>
<label>Format<select name="format">${['png', 'jpeg', 'webp'].map((f) => `<option ${values.format === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
<label class="check"><input type="checkbox" name="full_page" value="1" ${values.full_page ? 'checked' : ''}> Full page</label>
<label class="check"><input type="checkbox" name="dark_mode" value="1" ${values.dark_mode ? 'checked' : ''}> Dark mode</label>
<label class="check"><input type="checkbox" name="download" value="1" ${values.download ? 'checked' : ''}> Download</label></div>
<button class="btn">Take screenshot</button></form></section>` });
}

function paddleCheckout({ config, user, plan, priceId }) {
  const p = config.plans[plan];
  return layout({ config, user, title: `Checkout · ${p.name}`, body: `
<section class="narrow"><h1>${esc(p.name)} plan</h1><p class="lead">${money(p.priceCents)}/month · ${n(p.monthly)} renders. The secure checkout opens in a moment; if it does not, <a href="#" id="open">click here</a>.</p>
<p class="fine">Payments are processed by Paddle.com, our merchant of record. Your plan activates automatically after payment.</p></section>
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

const error = ({ config, status, message }) => layout({ config, title: String(status), body: `<section class="narrow"><h1>${esc(status)}</h1><p class="lead">${esc(message)}</p><p><a href="/">Back to the start</a></p></section>` });

module.exports = { layout, home, pricing, docs, signup, login, dashboard, toolPdf, toolShot, paddleCheckout, error, esc, DOC_LANGS };
