const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'public');
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:8123');
  let p = url.pathname;
  if (p === '/redirect') { res.writeHead(302, { Location: '/about.html' }); return res.end(); }
  if (p === '/brochure.pdf') { res.writeHead(200, { 'Content-Type': 'application/pdf' }); return res.end('%PDF-1.4 fake'); }
  if (p === '/logo.png' || p === '/w.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><title>404</title><h1>Not found</h1>'); }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(file).pipe(res);
}).listen(8123, '127.0.0.1', () => console.log('testsite on http://127.0.0.1:8123'));
