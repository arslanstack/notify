# Notify

A self-hosted transactional email dispatch API built on Laravel 13, Inertia.js, and React 19. Expose a single authenticated endpoint, queue every email through Redis, and track delivery, SMTP responses, and errors in an admin dashboard.

## Features

- **`POST /api/mail/sendmail`** — accepts an email payload, queues it, and returns `202 Accepted` immediately (sub-50ms response).
- **Queued delivery** — emails are dispatched via a Redis-backed job (`SendMailJob`) so the API never blocks on SMTP.
- **Full audit trail** — every email is logged with recipient, sender, subject, body, status, SMTP response, error message, and timestamps.
- **Admin dashboard** — searchable, filterable, paginated table of all mail logs with a detail modal and HTML body preview.
- **API key auth** — requests are authenticated via the `X-API-Key` header.
- **Single-admin login** — registration is disabled; the dashboard is protected behind Fortify auth.

## Requirements

- PHP 8.4+
- Node 20+
- Redis
- An SMTP provider (configured for Resend out of the box)

## Setup

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
npm run build
```

Configure your SMTP, Redis, and `API_KEY` values in `.env`.

### Default admin

```
email:    admin@notify.com
password: 123456
```

> Change these in `database/seeders/DatabaseSeeder.php` before deploying.

## Running locally

```bash
php artisan serve            # app
php artisan queue:work redis # worker
npm run dev                  # assets
```

## API usage

Send an email:

```bash
curl -X POST https://your-domain.com/api/mail/sendmail \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "to_email": "recipient@example.com",
    "to_name": "John Doe",
    "from_email": "noreply@yourdomain.com",
    "from_name": "Your App",
    "subject": "Hello",
    "body_html": "<h1>Hi John</h1><p>Welcome aboard.</p>"
  }'
```

Required fields: `to_email`, `from_email`, `from_name`, `subject`, `body_html`.
Optional: `to_name`, `body_text`, `reply_to_email`, `reply_to_name`, `cc[]`, `bcc[]`, `headers{}`.

A Postman collection is included: [`notify-postman-collection.json`](notify-postman-collection.json).

## Production worker

Run the queue worker under Supervisor so it survives reboots and deploys:

```ini
[program:notify-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path/to/notify/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
user=notify
numprocs=2
redirect_stderr=true
stdout_logfile=/path/to/notify/storage/logs/worker.log
stopwaitsecs=3600
```

Run `php artisan queue:restart` after every deploy so workers reload updated code and config.
