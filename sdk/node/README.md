# renderkit-client

```
npm install renderkit-client
```

```js
const { RenderKit } = require('renderkit-client');
const rk = new RenderKit(process.env.RENDERKIT_KEY, { baseUrl: 'https://YOUR-RENDERKIT-HOST' });

const pdf = await rk.pdf({ html: '<h1>Invoice #42</h1>', format: 'A4', margin: '12mm' }); // Buffer
const png = await rk.screenshot({ url: 'https://example.com', full_page: true });
const { used, limit } = await rk.usage();
```

Zero dependencies, Node 18+, TypeScript types included. Errors are `RenderKitError` with `status`, `code`, `isQuotaExceeded`, `isRateLimited`.
