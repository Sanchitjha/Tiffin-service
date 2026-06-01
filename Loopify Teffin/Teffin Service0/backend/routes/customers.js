const express = require("express");
const router = express.Router();
const { db, uid, json, rowToCustomer } = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM customers ORDER BY name COLLATE NOCASE").all();
  res.json(rows.map(rowToCustomer));
});

router.get("/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id);
  if (!r) return res.status(404).json({ error: "Not found" });
  const orders = db.prepare("SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC").all(r.id);
  const subs = db.prepare("SELECT * FROM subscriptions WHERE customer_id = ?").all(r.id);
  const c = rowToCustomer(r);
  c.orders = orders.map(o => ({ id: o.id, total: o.total, status: o.status, items: json.parse(o.items, []), createdAt: o.created_at }));
  c.subscriptions = subs.map(s => ({ id: s.id, name: s.name, frequency: s.frequency, status: s.status, nextDelivery: s.next_delivery }));
  c.ltv = orders.filter(o => o.status === "delivered").reduce((s, o) => s + o.total, 0);
  res.json(c);
});

router.post("/", (req, res) => {
  const { name, phone, email, area, address, tags, notes, preferences } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const id = uid("c_");
  db.prepare("INSERT INTO customers (id, name, phone, email, area, address, tags, notes, preferences, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, name, phone || null, email || null, area || null, address || null, json.stringify(tags || []), notes || null, json.stringify(preferences || {}), Date.now());
  res.json(rowToCustomer(db.prepare("SELECT * FROM customers WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const { name, phone, email, area, address, tags, notes, preferences } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const existing = db.prepare("SELECT id FROM customers WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  db.prepare("UPDATE customers SET name=?, phone=?, email=?, area=?, address=?, tags=?, notes=?, preferences=? WHERE id=?")
    .run(name, phone || null, email || null, area || null, address || null, json.stringify(tags || []), notes || null, json.stringify(preferences || {}), req.params.id);
  res.json(rowToCustomer(db.prepare("SELECT * FROM customers WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM customers WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
