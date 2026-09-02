# RenderKit PHP client

```
composer require renderkit/renderkit
```

```php
$rk = new \RenderKit\Client(getenv('RENDERKIT_KEY'), 'https://YOUR-RENDERKIT-HOST');

// PDF from your own HTML (Twig, Blade, plain string)
$pdf = $rk->pdf(['html' => $html, 'format' => 'A4', 'margin' => '12mm',
    'footer_template' => '<div style="font-size:9px;width:100%;text-align:center"><span class="pageNumber"></span>/<span class="totalPages"></span></div>']);
file_put_contents('invoice.pdf', $pdf);

// or straight to the browser
$rk->stream($pdf, 'invoice-42.pdf');

// Screenshot of a URL
$png = $rk->screenshot(['url' => 'https://example.com', 'full_page' => true, 'device_scale_factor' => 2]);
```

Errors throw `RenderKit\RenderKitException` with `getStatus()`, `getErrorCode()`, `isQuotaExceeded()`, `isRateLimited()`.

No dependencies beyond ext-curl and ext-json. PHP 8.1+.
