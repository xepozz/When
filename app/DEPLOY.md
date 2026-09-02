# Deploy RenderKit

## Для рынка РФ: краткий маршрут
1. **Хостинг в России** (российские карты принимают, задержка до клиентов минимальная): Timeweb Cloud, Selectel, Yandex Cloud, VDSina, reg.ru. Нужен VPS 2–4 ГБ RAM с Ubuntu 24.04 и Docker. Домен .ru у любого регистратора.
2. Шаги 1–2 ниже (DNS, `docker compose up`). В `.env`: `CURRENCY=RUB`, `SITE_LANG=ru`, реквизиты `LEGAL_*`.
3. **ЮKassa** (раздел 3c ниже): регистрация магазина, ИП/ООО или самозанятый, чеки 54-ФЗ, автоплатежи.
4. Проверка: регистрация на сайте, оплата тестовой картой из личного кабинета ЮKassa, тариф в кабинете обновился.

Target: one VPS with 2–4 GB RAM (Hetzner CX22 at ~€4/month handles the Starter/Pro traffic of dozens of customers). Docker Compose runs the app and Caddy (automatic HTTPS).

## 1. DNS
Point `api.yourdomain.com` (A record) at the VPS.

## 2. Server
```
ssh root@VPS
apt-get update && apt-get install -y docker.io docker-compose-v2 git
git clone <this repo> renderkit && cd renderkit/app
cp .env.example .env
openssl rand -hex 32   # paste as SESSION_SECRET
nano .env              # APP_URL, DOMAIN, SESSION_SECRET, Stripe keys (step 3)
docker compose up -d --build
docker compose logs -f app   # wait for "Server listening"
```
Open `https://api.yourdomain.com/health` → `{"ok":true,"browser":true,...}`.

## 3. Payments (15 minutes, once)

Pick one provider and set `BILLING_PROVIDER` accordingly.

### 3c. ЮKassa (Россия)
1. https://yookassa.ru → «Подключить». Варианты: ИП или ООО (любая система налогообложения) либо самозанятый (НПД) — для последнего доступен ограниченный набор способов оплаты, уточните при подключении. Проверка документов занимает 1–3 рабочих дня.
2. На модерации ЮKassa проверит сайт: должны быть видны реквизиты (подвал), описание услуги и цены (`/pricing`), оферта (`/offer`), политика конфиденциальности (`/privacy`), контакты. Всё это уже на сайте, если заполнены `LEGAL_*` в `.env`.
3. Личный кабинет → Интеграция → Ключи API: `shopId` → `YOOKASSA_SHOP_ID`, секретный ключ → `YOOKASSA_SECRET_KEY`.
4. Интеграция → HTTP-уведомления: URL `https://api.ваш-домен.ru/billing/yookassa/webhook`, события `payment.succeeded`, `payment.canceled`, `refund.succeeded`. Уведомления не подписываются; сервис сам перепроверяет каждый платёж запросом к API ЮKassa, поэтому подделать их нельзя.
5. **Чеки (54-ФЗ).** Для ИП/ООО подключите онлайн-кассу через ЮKassa (Чеки → выбрать партнёра, например «Атол Онлайн» или «Бизнес.Ру») и оставьте `YOOKASSA_SEND_RECEIPT=1`; `YOOKASSA_VAT_CODE=1` для УСН без НДС. Самозанятым касса не нужна: ЮKassa формирует чек в «Мой налог» сама.
6. **Автопродление.** Напишите в поддержку ЮKassa: «включить автоплатежи (сохранение способа оплаты) для магазина №…». Без этого `YOOKASSA_AUTOPAY=0`: клиент продлевает вручную кнопкой в кабинете, доступ до конца оплаченных 30 дней.
7. Тест: в личном кабинете ЮKassa включите тестовый магазин, возьмите тестовые ключи и карту `5555 5555 5555 4477`, оплатите тариф на своём сайте, убедитесь, что кабинет показывает тариф и дату «оплачено до».

### 3a. Paddle (works from any non-sanctioned country; Paddle is the merchant of record and handles VAT/sales tax)
1. https://paddle.com → create a seller account (business verification takes 1–3 days; you can build with the sandbox meanwhile at https://sandbox-vendors.paddle.com).
2. Catalog → Products → "RenderKit" with three recurring monthly prices: $9, $29, $79. Copy the `pri_...` ids into `PADDLE_PRICE_*`.
3. Developer tools → Authentication → API key → `PADDLE_API_KEY`; client-side token → `PADDLE_CLIENT_TOKEN`.
4. Developer tools → Notifications → new destination `https://api.yourdomain.com/billing/paddle/webhook`, events: `transaction.completed`, `subscription.activated`, `subscription.updated`, `subscription.canceled`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`. Copy the secret into `PADDLE_WEBHOOK_SECRET`.
5. Checkout → Website approval: add your domain (required before live checkouts).
6. `docker compose up -d` again. Test in sandbox with card `4242 4242 4242 4242`; the dashboard must show the new plan after the webhook.

### 3b. Stripe (only if you have a business in a Stripe-supported country)
1. Stripe Dashboard → Product catalog → add product "RenderKit" with three recurring monthly prices: $9 (Starter), $29 (Pro), $79 (Business). Copy the three `price_...` ids into `.env`.
2. Developers → API keys → secret key into `STRIPE_SECRET_KEY`.
3. Developers → Webhooks → add endpoint `https://api.yourdomain.com/billing/webhook` with events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. Settings → Billing → Customer portal: enable, allow cancellations and plan switches between the three prices.
5. `docker compose up -d` again to load the new env.

Test with Stripe test keys first: sign up on your site, pick Pro, pay with card `4242 4242 4242 4242`, confirm the dashboard shows "Pro" after the webhook lands.

## 4. Backups
The whole state is one SQLite file in the `data` volume:
```
docker compose exec app sqlite3 /data/renderkit.db ".backup /data/backup.db"   # or just copy the file while the app runs (WAL mode)
```
A nightly `cp` to object storage is enough.

## 5. Scaling
- `RENDER_CONCURRENCY` = number of CPU cores is a good start; each render is one isolated browser context.
- Memory: ~150–300 MB per concurrent render on heavy pages. `shm_size` in compose is set to 1 GB.
- Beyond one box: run several app containers behind Caddy with the same SQLite on a shared volume is NOT supported; move `usage`/`users` to Postgres at that point (the SQL is plain and small).

## 6. Getting found (what the code already does)
- `/sitemap.xml` and `/robots.txt` are served; submit the sitemap in Google Search Console.
- The free tools pages target the searches "html to pdf online" and "website screenshot online"; the docs pages target "pdf api php/laravel/node/python/ruby/go".
- List the API on RapidAPI and on the "awesome" lists for PDF generation / screenshot APIs; both are free listings with real search traffic.
