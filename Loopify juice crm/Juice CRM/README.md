# DabbaBox — Tiffin Service CRM

A production-grade, self-hosted CRM for a tiffin delivery business: customers, orders with delivery tracking, recurring subscriptions, products & inventory, leads pipeline, delivery partners, WhatsApp inbox (real webhook), reports, and a calendar.

**Stack:** Node.js + Express + SQLite on the backend. Vanilla JS + Inter/Fraunces typography on the frontend. JWT auth. No build step. ~3,500 lines total.

---

## Quick start

### Prerequisites
- **Node.js v18+** — install from [nodejs.org](https://nodejs.org) if you don't have it.

### Run it (Windows)
Double-click `start.bat`. It will install dependencies on first run (~30s), then start the server and open your browser.

### Run it (macOS / Linux)
```bash
chmod +x start.sh
./start.sh
```

Either way, the app will be live at **http://localhost:4000**.

### Default login
```
Email:    admin@dabbabox.in
Password: dabbabox@2026
```
Change the password under **Settings → Account** after first sign-in. (Or edit `backend/.env` before first run to set your own defaults.)

---

## What's inside

```
Tiffin CRM/
├── start.bat / start.sh          One-click launchers
├── README.md
├── backend/
│   ├── server.js                 Express entry, serves API + static frontend
│   ├── db.js                     SQLite schema + helpers
│   ├── auth.js                   JWT + bcrypt
│   ├── seed.js                   Demo data
│   ├── reset.js                  Wipes + reseeds (`npm run reset`)
│   ├── package.json
│   ├── .env.example              Copy to .env to override defaults
│   ├── routes/                   REST endpoints
│   │   ├── auth.js  customers.js  products.js  partners.js
│   │   ├── orders.js  subscriptions.js  leads.js
│   │   ├── whatsapp.js  reports.js  settings.js
│   └── data/dabbabox.db          SQLite database (auto-created)
└── frontend/
    ├── index.html  login.html
    ├── css/styles.css
    └── js/
        ├── icons.js  utils.js  state.js  api.js  auth.js  ui.js  router.js  app.js
        └── pages/
            ├── dashboard.js  customers.js  orders.js
            ├── subscriptions.js  products.js  leads.js
            ├── partners.js  whatsapp.js  calendar.js
            ├── reports.js  settings.js
```

---

## Features

**Sales**
- Customers (CRUD, search, lifetime value, order history, CSV export, tags)
- Orders (line items, statuses pending → delivered, partner assignment, tracking timeline, printable invoices, WhatsApp notify)
- Subscriptions (daily/weekly/biweekly/monthly cadences, pause/resume, MRR estimate)
- Leads & follow-ups (kanban with drag-and-drop, convert to customer)

**Operations**
- Products & inventory (tiffin items, stock levels, low-stock alerts, automatic stock decrement on delivery, movement log)
- Delivery partners (riders with active/delivered/total stats)
- WhatsApp inbox with **real webhook** for Meta Cloud API / Twilio (see below)

**Insights**
- Dashboard with KPIs, revenue trend, status mix, top customers, popular tiffins, today's deliveries/follow-ups
- Reports (revenue over time, revenue by area, top customers, product performance, lead conversion)
- Calendar view (orders, subscription deliveries, follow-ups overlaid)

**System**
- JWT-based authentication
- Light & dark mode (Botanical Garden palette: fern green + marigold + terracotta on cream)
- Command palette (⌘K)
- Keyboard shortcuts (⌘K, /, esc)
- Notifications popover (low stock, follow-ups due, deliveries in progress, unread WhatsApp)

---

## WhatsApp integration

The backend exposes a real webhook your bot provider can call:

```
GET  http://your-server/api/whatsapp/webhook   (verification handshake)
POST http://your-server/api/whatsapp/webhook   (inbound messages)
```

**Verify token** is set in `backend/.env` as `WHATSAPP_VERIFY_TOKEN` (default: `dabbabox-verify-token-2026`).

Both **Meta Cloud API** and **Twilio** payload formats are auto-detected. A generic `{ phone, name, text }` JSON body also works (handy for custom bots).

For local development, expose your server with [ngrok](https://ngrok.com) or [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) so Meta/Twilio can reach you:

```bash
ngrok http 4000
# Configure webhook URL: https://<your-ngrok>.ngrok.io/api/whatsapp/webhook
```

**Outbound messages via Twilio** — set these three env vars in `backend/.env` and outbound replies from the inbox will actually go out over WhatsApp:

```
TWILIO_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_TOKEN=your_auth_token
TWILIO_FROM=whatsapp:+14155238886
```

Without these, the message is still recorded in the inbox (handy for testing), and the response payload includes `provider.reason: "Twilio not configured"` so you can tell.

---

## CLI commands

From `backend/`:

```bash
npm start    # Start the server
npm run dev  # Start with file-watch hot reload (Node 18+)
npm run seed # Insert demo data (skips if customers already exist)
npm run reset # Wipe all data and reseed
```

---

## Environment variables (`backend/.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `JWT_SECRET` | `change-me-…` | **Change this in production.** Token signing key. |
| `ADMIN_EMAIL` | `admin@dabbabox.in` | Default admin email (only on first run) |
| `ADMIN_PASSWORD` | `dabbabox@2026` | Default admin password (only on first run) |
| `WHATSAPP_VERIFY_TOKEN` | `dabbabox-verify-token-2026` | Webhook verification token |
| `TWILIO_SID` | — | Optional: Twilio Account SID for real outbound sending |
| `TWILIO_TOKEN` | — | Optional: Twilio Auth Token |
| `TWILIO_FROM` | — | Optional: sender number in `whatsapp:+14155238886` format |

---

## Data & backups

Three ways to back up:

1. **In-app JSON backup** — Settings → "Download backup (JSON)" exports the full database as a single JSON file. Restore from the same page.
2. **CSV exports** — Settings → "Customers (CSV)" / "Orders (CSV)" for spreadsheet-friendly extracts.
3. **File-level** — copy `backend/data/dabbabox.db` to back up the raw SQLite database; paste it back to migrate machines.

There's also **Reset to demo data** in Settings if you want to wipe everything and start over with the seed dataset.

---

## Deploying to a server

1. Spin up a $5/month Ubuntu VPS (Hetzner / DigitalOcean / Linode).
2. Install Node.js v18+.
3. Clone or upload this folder.
4. `cd backend && npm install`.
5. Edit `.env` — **set a strong `JWT_SECRET`**, change admin password.
6. Run with [pm2](https://pm2.keymetrics.io/) for production: `npm i -g pm2 && pm2 start server.js --name dabbabox`.
7. Put nginx in front for HTTPS termination + serve `/api/whatsapp/webhook` to the world.

---

## Tech notes

- **No build step.** Everything is hand-written ES2020+ JS served as plain files. Refresh = changes apply.
- **SQLite via better-sqlite3** for synchronous, atomic, fast queries.
- **Foreign keys are enabled** so deleting a customer cascades to their orders & subscriptions.
- **Tokens live for 30 days** (configurable in `auth.js`).
