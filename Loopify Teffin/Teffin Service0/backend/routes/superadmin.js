/* =========================================================================
   Super Admin Endpoints
   ========================================================================= */
const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { systemDb, getTenantDb, uid } = require("../db");
const { requireAuth } = require("../auth");

// Authenticate first
router.use(requireAuth);

// Enforce Super Admin role
router.use((req, res, next) => {
  if (req.user.role !== "superadmin") {
    return res.status(403).json({ error: "Access denied: Super Admin role required" });
  }
  next();
});

/* ---- 1. Provider/Tenant Management ---- */

// GET all providers + admin user info + stats
router.get("/providers", (req, res) => {
  try {
    const tenants = systemDb.prepare("SELECT * FROM tenants ORDER BY created_at DESC").all();
    const users = systemDb.prepare("SELECT id, email, name, role, tenant_id FROM users WHERE role = 'admin'").all();
    
    const result = tenants.map(t => {
      const u = users.find(user => user.tenant_id === t.id);
      
      let customersCount = 0;
      let ordersCount = 0;
      try {
        const tenantDb = getTenantDb(t.id);
        customersCount = tenantDb.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
        ordersCount = tenantDb.prepare("SELECT COUNT(*) AS c FROM orders").get().c;
      } catch (e) {
        // Database not initialized or empty
      }

      return {
        ...t,
        admin: u ? { id: u.id, name: u.name, email: u.email } : null,
        stats: { customersCount, ordersCount }
      };
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST register a new provider
router.post("/providers", (req, res) => {
  const { id, businessName, ownerName, email, phone, city, area, whatsappNumber, password, plan } = req.body || {};
  if (!id || !businessName || !ownerName || !email || !phone || !city || !area || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const cleanId = id.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!cleanId) return res.status(400).json({ error: "Invalid provider ID" });
  
  const existsTenant = systemDb.prepare("SELECT * FROM tenants WHERE id = ?").get(cleanId);
  if (existsTenant) return res.status(400).json({ error: "Provider ID already taken" });
  
  const existsUser = systemDb.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (existsUser) return res.status(400).json({ error: "Email already registered" });
  
  const trialDays = 14;
  const trialEndsAt = Date.now() + trialDays * 86400000;
  
  const tx = systemDb.transaction(() => {
    // 1. Insert tenant details
    systemDb.prepare(`
      INSERT INTO tenants (id, business_name, owner_name, email, phone, city, area, whatsapp_number, status, plan, trial_ends_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cleanId, businessName, ownerName, email, phone, city, area, whatsappNumber || null, 'trial', plan || 'monthly', trialEndsAt, Date.now());
    
    // 2. Create the tenant's admin user account
    const userId = uid("u_");
    const hashedPassword = bcrypt.hashSync(password, 10);
    systemDb.prepare(`
      INSERT INTO users (id, email, name, password, role, tenant_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, email.toLowerCase(), ownerName, hashedPassword, 'admin', cleanId, Date.now());
  });
  
  try {
    tx();
    // Pre-initialize provider database
    const tenantDb = getTenantDb(cleanId);
    tenantDb.prepare("INSERT INTO activity (id, at, text, kind, ref) VALUES (?, ?, ?, ?, ?)")
      .run(uid("a_"), Date.now(), `Welcome to DabbaBox Tiffin CRM, ${businessName}!`, "info", null);
      
    res.json({ ok: true, providerId: cleanId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update provider profile
router.put("/providers/:id", (req, res) => {
  const { id } = req.params;
  const { business_name, owner_name, email, phone, city, area, whatsapp_number, status, plan, trial_ends_at, whatsapp_markup_rate } = req.body || {};
  
  const exists = systemDb.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
  if (!exists) return res.status(404).json({ error: "Provider not found" });
  
  try {
    systemDb.prepare(`
      UPDATE tenants
      SET business_name = ?, owner_name = ?, email = ?, phone = ?, city = ?, area = ?, whatsapp_number = ?, status = ?, plan = ?, trial_ends_at = ?, whatsapp_markup_rate = ?
      WHERE id = ?
    `).run(
      business_name !== undefined ? business_name : exists.business_name,
      owner_name !== undefined ? owner_name : exists.owner_name,
      email !== undefined ? email : exists.email,
      phone !== undefined ? phone : exists.phone,
      city !== undefined ? city : exists.city,
      area !== undefined ? area : exists.area,
      whatsapp_number !== undefined ? whatsapp_number : exists.whatsapp_number,
      status !== undefined ? status : exists.status,
      plan !== undefined ? plan : exists.plan,
      trial_ends_at !== undefined ? (trial_ends_at ? Number(trial_ends_at) : null) : exists.trial_ends_at,
      whatsapp_markup_rate !== undefined ? Number(whatsapp_markup_rate) : exists.whatsapp_markup_rate,
      id
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET direct download of a provider's isolated SQLite database
router.get("/providers/:id/backup", (req, res) => {
  const { id } = req.params;
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "..", "data");
  const dbPath = path.join(DATA_DIR, `tenant_${id}.db`);
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: "Database file not found for this provider" });
  }
  res.download(dbPath, `dabbabox-tenant-${id}.db`);
});


/* ---- 2. Billing & Invoices ---- */

// GET all billing invoices
router.get("/billing", (req, res) => {
  try {
    const invoices = systemDb.prepare(`
      SELECT i.*, t.business_name
      FROM invoices i
      JOIN tenants t ON i.tenant_id = t.id
      ORDER BY i.created_at DESC
    `).all();
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST generate new invoice
router.post("/billing", (req, res) => {
  const { tenantId, amount, dueDate } = req.body || {};
  if (!tenantId || !amount || !dueDate) {
    return res.status(400).json({ error: "tenantId, amount and dueDate are required" });
  }
  try {
    const id = uid("inv_");
    systemDb.prepare(`
      INSERT INTO invoices (id, tenant_id, amount, status, due_date, created_at)
      VALUES (?, ?, ?, 'unpaid', ?, ?)
    `).run(id, tenantId, Number(amount), dueDate, Date.now());
    res.json({ ok: true, invoiceId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update invoice status
router.put("/billing/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });
  try {
    systemDb.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ---- 3. Support Tickets ---- */

// GET all support tickets
router.get("/tickets", (req, res) => {
  try {
    const tickets = systemDb.prepare(`
      SELECT s.*, t.business_name
      FROM support_tickets s
      JOIN tenants t ON s.tenant_id = t.id
      ORDER BY s.created_at DESC
    `).all();
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update ticket status (solve/close)
router.put("/tickets/:id", (req, res) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status) return res.status(400).json({ error: "status required" });
  try {
    systemDb.prepare("UPDATE support_tickets SET status = ? WHERE id = ?").run(status, id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ---- 4. System Analytics ---- */

router.get("/analytics", (req, res) => {
  try {
    const totalTenants = systemDb.prepare("SELECT COUNT(*) AS c FROM tenants").get().c;
    const activeTenants = systemDb.prepare("SELECT COUNT(*) AS c FROM tenants WHERE status = 'active'").get().c;
    const trialTenants = systemDb.prepare("SELECT COUNT(*) AS c FROM tenants WHERE status = 'trial'").get().c;
    
    // Invoices sum
    const totalRevenue = systemDb.prepare("SELECT SUM(amount) AS total FROM invoices WHERE status = 'paid'").get().total || 0;
    
    let totalCustomers = 0;
    let totalOrders = 0;
    
    const tenants = systemDb.prepare("SELECT id FROM tenants").all();
    for (const t of tenants) {
      try {
        const tenantDb = getTenantDb(t.id);
        totalCustomers += tenantDb.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
        totalOrders += tenantDb.prepare("SELECT COUNT(*) AS c FROM orders").get().c;
      } catch (e) {
        // Ignore if database file not initialized
      }
    }
    
    res.json({
      totalTenants,
      activeTenants,
      trialTenants,
      totalRevenue,
      totalCustomers,
      totalOrders,
      revenueHistory: [
        { month: "Jan", amount: Math.round(totalRevenue * 0.2) },
        { month: "Feb", amount: Math.round(totalRevenue * 0.4) },
        { month: "Mar", amount: Math.round(totalRevenue * 0.6) },
        { month: "Apr", amount: Math.round(totalRevenue * 0.8) },
        { month: "May", amount: Math.round(totalRevenue) }
      ]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ---- 5. System Settings ---- */

router.get("/settings", (req, res) => {
  try {
    const rows = systemDb.prepare("SELECT key, value FROM settings").all();
    const out = {};
    rows.forEach(r => {
      try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; }
    });
    res.json({
      trial_days: out.trial_days || 14,
      monthly_plan_price: out.monthly_plan_price || 2999,
      yearly_plan_price: out.yearly_plan_price || 29999,
      whatsapp_markup_rate: out.whatsapp_markup_rate || 0.05
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/settings", (req, res) => {
  const { trial_days, monthly_plan_price, yearly_plan_price, whatsapp_markup_rate } = req.body || {};
  
  const setSetting = (key, val) => {
    systemDb.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run(key, JSON.stringify(val));
  };
  
  try {
    if (trial_days !== undefined) setSetting("trial_days", Number(trial_days));
    if (monthly_plan_price !== undefined) setSetting("monthly_plan_price", Number(monthly_plan_price));
    if (yearly_plan_price !== undefined) setSetting("yearly_plan_price", Number(yearly_plan_price));
    if (whatsapp_markup_rate !== undefined) setSetting("whatsapp_markup_rate", Number(whatsapp_markup_rate));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
