/* =========================================================================
   Database — SQLite via better-sqlite3 (Multi-Tenant)
   System database at data/system.db.
   Tenant databases at data/tenant_<tenant_id>.db.
   ========================================================================= */
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { AsyncLocalStorage } = require("async_hooks");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Central system database
const systemDb = new Database(path.join(DATA_DIR, "system.db"));
systemDb.pragma("journal_mode = WAL");
systemDb.pragma("foreign_keys = ON");

/* ---------- System Schema ---------- */
systemDb.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id                    TEXT PRIMARY KEY,
  business_name         TEXT NOT NULL,
  owner_name            TEXT NOT NULL,
  email                 TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  city                  TEXT NOT NULL,
  area                  TEXT NOT NULL,
  whatsapp_number       TEXT UNIQUE,
  status                TEXT NOT NULL DEFAULT 'trial',
  plan                  TEXT NOT NULL DEFAULT 'monthly',
  trial_ends_at         INTEGER,
  whatsapp_markup_rate  REAL NOT NULL DEFAULT 0.05,
  created_at            INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  password     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'admin',
  tenant_id    TEXT,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  amount       REAL NOT NULL,
  status       TEXT NOT NULL DEFAULT 'unpaid',
  due_date     TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  subject      TEXT NOT NULL,
  description  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open',
  created_at   INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_api_usage (
  id           TEXT PRIMARY KEY,
  tenant_id    TEXT NOT NULL,
  direction    TEXT NOT NULL,
  type         TEXT NOT NULL,
  cost         REAL NOT NULL,
  at           INTEGER NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);
`);

/* ---------- Tenant Database Setup ---------- */
function initTenantDb(tenantDb) {
  tenantDb.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    phone        TEXT,
    email        TEXT,
    area         TEXT,
    address      TEXT,
    tags         TEXT,
    notes        TEXT,
    preferences  TEXT DEFAULT '{}',
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
    customizations    TEXT DEFAULT '[]',
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

  CREATE TABLE IF NOT EXISTS bot_sessions (
    phone       TEXT PRIMARY KEY,
    state       TEXT NOT NULL,
    data        TEXT NOT NULL,
    updated_at  INTEGER NOT NULL
  );
  `);
}

/* ---------- Connections Cache & Context Manager ---------- */
const connections = new Map();
const asyncLocalStorage = new AsyncLocalStorage();

function getTenantDb(tenantId) {
  if (!tenantId) return systemDb;
  if (connections.has(tenantId)) {
    return connections.get(tenantId);
  }
  const dbPath = path.join(DATA_DIR, `tenant_${tenantId}.db`);
  const newDb = new Database(dbPath);
  newDb.pragma("journal_mode = WAL");
  newDb.pragma("foreign_keys = ON");
  initTenantDb(newDb);
  connections.set(tenantId, newDb);
  return newDb;
}

// Proxy for dynamic database query routing
const db = new Proxy({}, {
  get(target, prop) {
    const store = asyncLocalStorage.getStore();
    const activeDb = (store && store.db) || systemDb;
    const value = activeDb[prop];
    if (typeof value === "function") {
      return value.bind(activeDb);
    }
    return value;
  }
});

/* ---------- Migration from Legacy single-tenant DabbaBox DB ---------- */
(function migrateLegacy() {
  const oldDbPath = path.join(DATA_DIR, "dabbabox.db");
  const defaultTenantPath = path.join(DATA_DIR, `tenant_default.db`);
  if (fs.existsSync(oldDbPath) && !fs.existsSync(defaultTenantPath)) {
    console.log("Migrating legacy dabbabox.db to tenant_default.db...");
    try {
      fs.copyFileSync(oldDbPath, defaultTenantPath);
      
      const tempDb = new Database(defaultTenantPath);
      let legacyUsers = [];
      try {
        legacyUsers = tempDb.prepare("SELECT * FROM users").all();
      } catch {}
      tempDb.close();

      // Seed default tenant
      systemDb.prepare(`
        INSERT OR IGNORE INTO tenants (id, business_name, owner_name, email, phone, city, area, whatsapp_number, status, plan, trial_ends_at, whatsapp_markup_rate, created_at)
        VALUES ('default', 'DabbaBox Tiffin Service', 'Admin', 'admin@dabbabox.in', '+91 98765 00000', 'Surat', 'Adajan', '+919876500001', 'active', 'monthly', NULL, 0.05, ?)
      `).run(Date.now());

      // Migrate legacy users to systemDb
      const insertUser = systemDb.prepare(`
        INSERT OR IGNORE INTO users (id, email, name, password, role, tenant_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      legacyUsers.forEach(u => {
        insertUser.run(u.id, u.email, u.name, u.password, u.role || 'admin', 'default', u.created_at || Date.now());
      });

      console.log("✓ Legacy dabbabox.db migrated successfully to default tenant.");
    } catch (e) {
      console.error("Error migrating legacy database:", e.message);
    }
  }
})();

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
  systemDb, getTenantDb, asyncLocalStorage,
  rowToCustomer, rowToProduct, rowToPartner, rowToOrder, rowToSubscription, rowToLead, rowToWa,
};
