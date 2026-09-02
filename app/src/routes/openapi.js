'use strict';
// OpenAPI 3.0 document: imported by RapidAPI, Postman, OpenAPI generators and AI agents.
module.exports = function openapi(config) {
  const common = {
    url: { type: 'string', format: 'uri', description: 'Public http(s) URL to render. Provide url or html.' },
    html: { type: 'string', description: 'Raw HTML to render (max 2 MB). Provide url or html.' },
    width: { type: 'integer', minimum: 100, maximum: 4000, default: 1280, description: 'Viewport width' },
    height: { type: 'integer', minimum: 100, maximum: 4000, default: 800, description: 'Viewport height' },
    device_scale_factor: { type: 'number', minimum: 1, maximum: 3, default: 1 },
    wait_until: { type: 'string', enum: ['load', 'domcontentloaded', 'networkidle', 'commit'], default: 'load' },
    wait_for: { type: 'string', description: 'CSS selector to wait for before rendering' },
    delay: { type: 'integer', minimum: 0, maximum: 10000, default: 0, description: 'Extra wait in ms' },
    timeout: { type: 'integer', minimum: 1000, maximum: 30000, default: 20000 },
    css: { type: 'string', description: 'CSS injected before rendering' },
    hide: { type: 'string', description: 'CSS selectors to hide, comma separated' },
    dark_mode: { type: 'boolean', default: false },
    block_ads: { type: 'boolean', default: false },
    user_agent: { type: 'string' },
    locale: { type: 'string', example: 'de-DE' },
    timezone: { type: 'string', example: 'Europe/Berlin' },
    response: { type: 'string', enum: ['json'], description: 'Return base64 JSON instead of the binary file' },
  };
  const pdf = {
    ...common,
    format: { type: 'string', enum: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'Letter', 'Legal', 'Tabloid', 'Ledger'], default: 'A4' },
    landscape: { type: 'boolean', default: false },
    margin: { type: 'string', default: '10mm', description: 'CSS length for all margins' },
    print_background: { type: 'boolean', default: true },
    pdf_scale: { type: 'number', minimum: 0.1, maximum: 2, default: 1 },
    page_ranges: { type: 'string', example: '1-3,5' },
    header_template: { type: 'string', description: 'HTML; spans with classes pageNumber, totalPages, date, title, url are filled in' },
    footer_template: { type: 'string' },
    prefer_css_page_size: { type: 'boolean', default: false },
    media: { type: 'string', enum: ['print', 'screen'], default: 'print' },
  };
  const shot = {
    ...common,
    format: { type: 'string', enum: ['png', 'jpeg', 'webp'], default: 'png' },
    quality: { type: 'integer', minimum: 1, maximum: 100, default: 80 },
    full_page: { type: 'boolean', default: false },
    selector: { type: 'string', description: 'Screenshot only this element' },
    clip: { type: 'string', example: '0,0,800,600', description: 'x,y,width,height' },
    transparent: { type: 'boolean', default: false },
  };
  const toParams = (props) => Object.entries(props).map(([name, schema]) => ({ name, in: 'query', schema, description: schema.description }));
  const errors = {
    400: { description: 'Invalid parameter', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    401: { description: 'Missing or invalid API key', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    402: { description: 'Monthly quota exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    422: { description: 'Render failed (target unreachable, selector not found, private host)', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
  };
  const op = (kind, props, mime, summary) => ({
    post: { summary, operationId: `${kind}Post`, tags: [kind], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: props } } } },
      responses: { 200: { description: 'The rendered file', headers: { 'X-RenderKit-Time': { schema: { type: 'integer' }, description: 'Render time in ms' }, 'X-RenderKit-Usage': { schema: { type: 'string' }, description: 'used/limit this month' } }, content: Object.fromEntries(mime.map((m) => [m, { schema: { type: 'string', format: 'binary' } }])) }, ...errors } },
    get: { summary: summary + ' (query parameters)', operationId: `${kind}Get`, tags: [kind], parameters: toParams(props), responses: { 200: { description: 'The rendered file' }, ...errors } },
  });
  return {
    openapi: '3.0.3',
    info: { title: `${config.appName} API`, version: '1.0.0', description: 'Render any URL or HTML to PDF or to a PNG/JPEG/WebP screenshot with headless Chrome. Authenticate with an API key as a Bearer token.', contact: { url: config.appUrl } },
    servers: [{ url: config.appUrl + '/v1' }],
    security: [{ bearerAuth: [] }],
    tags: [{ name: 'pdf' }, { name: 'screenshot' }, { name: 'account' }],
    paths: {
      '/pdf': op('pdf', pdf, ['application/pdf', 'application/json'], 'Render a URL or HTML to PDF'),
      '/screenshot': op('screenshot', shot, ['image/png', 'image/jpeg', 'image/webp', 'application/json'], 'Screenshot a URL or HTML'),
      '/usage': { get: { summary: 'Current month usage', operationId: 'usage', tags: ['account'], responses: { 200: { description: 'Usage', content: { 'application/json': { schema: { type: 'object', properties: { plan: { type: 'string' }, used: { type: 'integer' }, limit: { type: 'integer' }, period: { type: 'string', example: '2026-09' } } } } } }, 401: errors[401] } } },
    },
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key from the dashboard, e.g. rk_live_…' } },
      schemas: { Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } } } } },
    },
  };
};
