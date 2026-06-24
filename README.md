# Notify

A self-hosted transactional email dispatch API built on **Laravel 13 + Inertia.js + React 19**. Expose a single authenticated endpoint, queue every email through Redis so the API responds in milliseconds, and track every send — status, SMTP response, errors, timestamps — in an admin dashboard.

---

## Table of contents

- [What's inside](#whats-inside)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [API usage](#api-usage)
- [Local development](#local-development)
- [First-time production deploy](#first-time-production-deploy)
- [Subsequent deploys](#subsequent-deploys)
- [Queue worker (Supervisor)](#queue-worker-supervisor)
- [Gotchas & troubleshooting](#gotchas--troubleshooting)

---

## What's inside

- **`POST /api/mail/sendmail`** — accepts an email payload, queues it, and returns `202 Accepted` immediately (sub-50ms). API-key authenticated via the `X-API-Key` header.
- **Asynchronous delivery** — emails are sent by a Redis-backed queued job (`SendMailJob`, 3 retries with 10s backoff). The HTTP request never waits on SMTP.
- **Full audit trail** — every email is logged with recipient, sender, subject, HTML/text body, cc/bcc, custom headers, status, SMTP response, error message, attempt count, and timestamps.
- **Admin dashboard** — searchable, status-filterable, paginated table of all mail logs, with a detail modal that includes an HTML body preview. Stat cards for total / delivered / failed / pending.
- **Single-admin auth** — registration is disabled; the dashboard sits behind Laravel Fortify login.

## How it works

```
Client ──POST /api/mail/sendmail──▶ API (validate, write MailLog, dispatch job) ──202──▶ Client
                                              │
                                              ▼
                                      Redis queue
                                              │
                                              ▼
                              SendMailJob (Supervisor worker)
                                              │
                                       Resend SMTP ──▶ recipient
                                              │
                                              ▼
                                  MailLog updated (sent / failed)
```

The request path does no network I/O beyond a single DB insert and a Redis push — that's why it's fast and stays fast regardless of how slow the upstream SMTP is on any given send.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Laravel 13, PHP 8.4 |
| Frontend | Inertia.js v3, React 19, TypeScript, Tailwind CSS 4, Radix UI |
| Queue | Redis |
| Auth | Laravel Fortify (login only) |
| Mail | SMTP (configured for Resend) |
| DB | MySQL (production), SQLite (local dev) |

---

## API usage

### Endpoint

```
POST /api/mail/sendmail
```

### Headers

| Header | Value |
|---|---|
| `X-API-Key` | your API key (from `.env` → `API_KEY`) |
| `Content-Type` | `application/json` |
| `Accept` | `application/json` |

### Body

| Field | Type | Required | Notes |
|---|---|---|---|
| `to_email` | string (email) | ✅ | Recipient address |
| `from_email` | string (email) | ✅ | Must be on a **Resend-verified domain** |
| `from_name` | string | ✅ | Sender display name |
| `subject` | string | ✅ | |
| `body_html` | string | ✅ | Full HTML body |
| `to_name` | string | — | Recipient display name |
| `body_text` | string | — | Plain-text alternative |
| `reply_to_email` | string (email) | — | |
| `reply_to_name` | string | — | |
| `cc` | array of emails | — | |
| `bcc` | array of emails | — | |
| `headers` | object | — | Custom email headers |

### Example

```bash
curl -X POST https://your-domain.com/api/mail/sendmail \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"to_email":"recipient@example.com","to_name":"John Doe","from_email":"noreply@yourdomain.com","from_name":"Your App","subject":"Hello","body_html":"<h1>Hi John</h1><p>Welcome aboard.</p>"}'
```

### Responses

**202 Accepted** — queued:

```json
{
  "success": true,
  "message": "Email queued successfully.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "queued",
    "queued_at": "2026-06-24T10:30:00+00:00"
  }
}
```

**401 Unauthorized** — bad/missing API key:

```json
{ "success": false, "message": "Unauthorized. Invalid or missing API key." }
```

**422 Unprocessable Entity** — validation errors (standard Laravel `errors` object).

A ready-to-import Postman collection is included: [`notify-postman-collection.json`](notify-postman-collection.json). Set its `base_url` and `api_key` variables.

> ⚠️ Multi-line `curl` with `\` continuations breaks if you paste blank lines between them in a shell. Use the single-line form above to be safe.

---

## Local development

Requirements: PHP 8.4+, Node 20+, Redis.

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
npm run build
```

Run the three processes (separate terminals):

```bash
php artisan serve              # app
php artisan queue:work redis   # worker
npm run dev                    # assets (hot reload)
```

Default admin login (created by the seeder): **`admin@notify.com` / `123456`** — change this in `database/seeders/DatabaseSeeder.php` before deploying.

> Note: your local ISP/firewall may block outbound port 587, so emails can fail to send locally with a connection timeout. This is **not** a code bug — data-center servers (your VPS) have the port open. Verify on a host with `nc -zv smtp.resend.com 587`.

---

## First-time production deploy

Assumes a CloudPanel site with PHP 8.4, a MySQL database, and Redis (CloudPanel ships with Redis). Paths below use the CloudPanel convention `/home/<site-user>/htdocs/<domain>`.

### 1. Clone the code (site SSH)

```bash
cd /home/<site-user>/htdocs
rm -rf <domain>
git clone https://github.com/arslanstack/notify.git <domain>
cd <domain>
php -v        # confirm 8.4
```

### 2. Install dependencies

```bash
composer install --no-dev --optimize-autoloader
```

### 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Set at minimum:

```env
APP_NAME=Notify
APP_ENV=production
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=your_db
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password

QUEUE_CONNECTION=redis
CACHE_STORE=database
SESSION_DRIVER=database

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

MAIL_MAILER=smtp
MAIL_SCHEME=smtp                       # 587 = smtp (STARTTLS); 465 = smtps. NEVER tls/ssl.
MAIL_HOST=smtp.resend.com
MAIL_PORT=587
MAIL_USERNAME=resend
MAIL_PASSWORD=your_resend_smtp_password
MAIL_FROM_ADDRESS="noreply@your-verified-domain.com"
MAIL_FROM_NAME="${APP_NAME}"

API_KEY=generate_a_strong_one
```

Generate a strong API key:

```bash
php -r 'echo "notify_sk_".bin2hex(random_bytes(24))."\n";'
```

### 4. App key, database, storage

```bash
php artisan key:generate
php artisan migrate --force --seed
php artisan storage:link
```

### 5. Build frontend assets

If Node isn't installed, install it as the site user via nvm (no root needed):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

Then:

```bash
npm ci
npm run build
```

### 6. Cache config for production

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 7. Point the web root at `/public`

In CloudPanel → Site → **Settings → Root Directory**, set it to:

```
/home/<site-user>/htdocs/<domain>/public
```

Then set up the [queue worker](#queue-worker-supervisor) (one-time, root SSH).

---

## Subsequent deploys

After the one-time setup, updating is a single command (site SSH):

```bash
git pull origin main && \
composer install --no-dev --optimize-autoloader && \
php artisan migrate --force && \
npm ci && npm run build && \
php artisan config:cache && php artisan route:cache && php artisan view:cache && \
php artisan queue:restart
```

**Never skip `php artisan queue:restart`** — the running workers hold the old code and `.env` in memory until restarted. Supervisor relaunches them automatically.

---

## Queue worker (Supervisor)

One-time setup, **root SSH**. Keeps the worker running across reboots and deploys.

```bash
apt install -y supervisor
which php8.4        # confirm the binary path
nano /etc/supervisor/conf.d/notify-worker.conf
```

```ini
[program:notify-worker]
process_name=%(program_name)s_%(process_num)02d
command=/usr/bin/php8.4 /home/<site-user>/htdocs/<domain>/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=<site-user>
numprocs=2
redirect_stderr=true
stdout_logfile=/home/<site-user>/htdocs/<domain>/storage/logs/worker.log
stopwaitsecs=3600
```

Activate:

```bash
supervisorctl reread
supervisorctl update
supervisorctl start notify-worker:*
supervisorctl status        # expect 2 RUNNING processes
```

`--max-time=3600` makes each worker exit gracefully every hour so Supervisor restarts it fresh (picks up deployed code). Tail the log with:

```bash
tail -f /home/<site-user>/htdocs/<domain>/storage/logs/worker.log
```

---

## Gotchas & troubleshooting

| Symptom | Cause & fix |
|---|---|
| `401 Unauthorized` even with the right key | App code must read secrets via `config()`, not `env()`. After `config:cache`, all `env()` calls outside `config/*.php` return `null`. The API key is exposed through `config('services.notify.api_key')`. |
| Config/`.env` change has no effect | Config is cached. Re-run `php artisan config:cache`. |
| Code change not reflected in sends | Worker holds old code in memory. Run `php artisan queue:restart`. |
| `"tls" scheme is not supported` | `MAIL_SCHEME` must be `smtp` (port 587) or `smtps` (port 465), never `tls`/`ssl`. That old `MAIL_ENCRYPTION` key is gone in Laravel 13. |
| Email times out connecting to `smtp.resend.com:587` | Outbound 587 blocked (common on local/residential networks). Works on the VPS. Test with `nc -zv smtp.resend.com 587`. |
| Email logs as **Failed**, "domain not verified" | Verify your sending domain in the Resend dashboard, or use `onboarding@resend.dev` as `from_email` for testing. |
| `Call to undefined function fake()` in seeder | Faker is a dev dependency; production uses `--no-dev`. The seeder is written to not depend on it. |

### Maintenance note

`mail_logs` stores full HTML bodies, so the table grows with volume. Consider a scheduled prune (e.g. delete `sent` logs older than 90 days) once traffic picks up.
