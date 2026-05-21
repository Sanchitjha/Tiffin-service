/* =========================================================================
   Database — SQLite via better-sqlite3
   Single file at data/dabbabox.db. Auto-creates tables on first run.
   ========================================================================= */
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, "dabbabox.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

/* ---------- Schema ---------- */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  password     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'admin',
  created_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  area         TEXT,
  address      TEXT,
  tags         TEXT,
  notes        TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  emoji         TEXT,
  category      TEXT,
  price         REAL NOT NULL DEFAULT 0,
  stock         INTEGER NOT NULL DEFAULT 0,
  low_stock_at  INTEGER NOT NULL DEFAULT 5,
  description   TEXT
);

CREATE TABLE IF NOT EXISTS partners (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  phone     TEXT,
  area      TEXT,
  vehicle   TEXT,
  active    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,
  customer_id       TEXT NOT NULL,
  partner_id        TEXT,
  delivery_address  TEXT,
  items             TEXT NOT NULL,
  status            TEXT NOT NULL,
  notes             TEXT,
  delivery_fee      REAL NOT NULL DEFAULT 0,
  subtotal          REAL NOT NULL DEFAULT 0,
  total             REAL NOT NULL DEFAULT 0,
  events            TEXT NOT NULL DEFAULT '[]',
  created_at        INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (partner_id)  REFERENCES partners(id)  ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status   ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created  ON orders(created_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  customer_id     TEXT NOT NULL,
  frequency       TEXT NOT NULL,
  status          TEXT NOT NULL,
  next_delivery   TEXT,
  items           TEXT NOT NULL DEFAULT '[]',
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT,
  source      TEXT,
  stage       TEXT NOT NULL DEFAULT 'new',
  follow_up   TEXT,
  notes       TEXT,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id          TEXT PRIMARY KEY,
  phone       TEXT NOT NULL,
  name        TEXT,
  direction   TEXT NOT NULL,
  text        TEXT NOT NULL,
  unread      INTEGER NOT NULL DEFAULT 1,
  at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wa_phone ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_wa_at    ON whatsapp_messages(at);

CREATE TABLE IF NOT EXISTS stock_moves (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  delta       INTEGER NOT NULL,
  reason      TEXT,
  at          INTEGER NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activity (
  id    TEXT PRIMARY KEY,
  at    INTEGER NOT NULL,
  text  TEXT NOT NULL,
  kind  TEXT,
  ref   TEXT
);
CREATE INDEX IF NOT EXISTS idx_activity_at ON activity(at);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`);

/* ---------- Schema migrations (safe to re-run) ---------- */
const MIGRATIONS = [
  "ALTER TABLE orders ADD COLUMN customizations TEXT DEFAULT '[]'",
  "ALTER TABLE customers ADD COLUMN preferences TEXT DEFAULT '{}'",
];
for (const m of MIGRATIONS) { try { db.exec(m); } catch {} }

/* ---------- Helpers ---------- */
const json = {
  parse: (s, fallback = null) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } },
  stringify: (v) => JSON.stringify(v ?? null),
};

function rowToCustomer(r) {
  return r && { id: r.id, name: r.name, phone: r.phone, email: r.email, area: r.area, address: r.address, tags: json.parse(r.tags, []), notes: r.notes, preferences: json.parse(r.preferences, {}), createdAt: r.created_at };
}
function rowToProduct(r) {
  return r && { id: r.id, name: r.name, emoji: r.emoji, category: r.category, price: r.price, stock: r.stock, lowStockAt: r.low_stock_at, description: r.description };
}
function rowToPartner(r) {
  return r && { id: r.id, name: r.name, phone: r.phone, area: r.area, vehicle: r.vehicle, active: !!r.active };
}
function rowToOrder(r) {
  return r && { id: r.id, customerId: r.customer_id, partnerId: r.partner_id, deliveryAddress: r.delivery_address, items: json.parse(r.items, []), customizations: json.parse(r.customizations, []), status: r.status, notes: r.notes, deliveryFee: r.delivery_fee, subtotal: r.subtotal, total: r.total, events: json.parse(r.events, []), createdAt: r.created_at };
}
function rowToSubscription(r) {
  return r && { id: r.id, name: r.name, customerId: r.customer_id, frequency: r.frequency, status: r.status, nextDelivery: r.next_delivery, items: json.parse(r.items, []), createdAt: r.created_at };
}
function rowToLead(r) {
  return r && { id: r.id, name: r.name, phone: r.phone, source: r.source, stage: r.stage, followUp: r.follow_up, notes: r.notes, createdAt: r.created_at };
}
function rowToWa(r) {
  return r && { id: r.id, phone: r.phone, name: r.name, dir: r.direction, text: r.text, unread: !!r.unread, at: r.at };
}

function uid(prefix = "") {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

module.exports = {
  db, json, uid,
  rowToCustomer, rowToProduct, rowToPartner, rowToOrder, rowToSubscription, rowToLead, rowToWa,
};
