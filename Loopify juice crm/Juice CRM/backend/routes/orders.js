const express = require("express");
const router = express.Router();
const { db, uid, json, rowToOrder } = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

const STAGES = ["pending","confirmed","preparing","out_for_delivery","delivered","cancelled"];

function logActivity(text, kind, ref) {
  db.prepare("INSERT INTO activity (id, at, text, kind, ref) VALUES (?, ?, ?, ?, ?)")
    .run(uid("a_"), Date.now(), text, kind || "info", ref ? JSON.stringify(ref) : null);
}

function applyStockOnDelivered(order) {
  for (const it of order.items || []) {
    const p = db.prepare("SELECT * FROM products WHERE id = ?").get(it.productId);
    if (!p) continue;
    const newStock = Math.max(0, p.stock - it.qty);
    db.prepare("UPDATE products SET stock = ? WHERE id = ?").run(newStock, p.id);
    db.prepare("INSERT INTO stock_moves (id, product_id, delta, reason, at) VALUES (?, ?, ?, ?, ?)")
      .run(uid("sm_"), p.id, -it.qty, `Order #${order.id.slice(-6).toUpperCase()} delivered`, Date.now());
  }
}

router.get("/", (req, res) => {
  const { status, customerId, partnerId, limit } = req.query;
  let sql = "SELECT * FROM orders WHERE 1=1";
  const args = [];
  if (status) { sql += " AND status = ?"; args.push(status); }
  if (customerId) { sql += " AND customer_id = ?"; args.push(customerId); }
  if (partnerId) { sql += " AND partner_id = ?"; args.push(partnerId); }
  sql += " ORDER BY created_at DESC";
  if (limit) { sql += " LIMIT ?"; args.push(parseInt(limit)); }
  res.json(db.prepare(sql).all(...args).map(rowToOrder));
});

router.get("/:id", (req, res) => {
  const r = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!r) return res.status(404).json({ error: "Not found" });
  res.json(rowToOrder(r));
});

router.post("/", (req, res) => {
  const { customerId, partnerId, deliveryAddress, items, customizations, status, notes, deliveryFee } = req.body || {};
  if (!customerId) return res.status(400).json({ error: "customerId required" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items required" });
  const id = uid("o_");
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const fee = Number(deliveryFee) || 0;
  const total = subtotal + fee;
  const st = STAGES.includes(status) ? status : "pending";
  const events = [{ at: Date.now(), status: st, note: "Order created" }];
  const createdAt = Date.now();
  db.prepare("INSERT INTO orders (id, customer_id, partner_id, delivery_address, items, customizations, status, notes, delivery_fee, subtotal, total, events, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, customerId, partnerId || null, deliveryAddress || null, json.stringify(items), json.stringify(Array.isArray(customizations) ? customizations : []), st, notes || null, fee, subtotal, total, json.stringify(events), createdAt);
  const order = rowToOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(id));
  if (st === "delivered") applyStockOnDelivered(order);
  const cu = db.prepare("SELECT name FROM customers WHERE id = ?").get(customerId);
  logActivity(`Order #${id.slice(-6).toUpperCase()} created — ${cu?.name || ""} • ₹${total} • ${st}`, "info", { orderId: id });
  res.json(order);
});

router.put("/:id", (req, res) => {
  const prev = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!prev) return res.status(404).json({ error: "Not found" });
  const { customerId, partnerId, deliveryAddress, items, customizations, status, notes, deliveryFee } = req.body || {};
  if (!customerId) return res.status(400).json({ error: "customerId required" });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items required" });
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0);
  const fee = Number(deliveryFee) || 0;
  const total = subtotal + fee;
  const st = STAGES.includes(status) ? status : prev.status;
  const events = json.parse(prev.events, []);
  if (prev.status !== st) events.unshift({ at: Date.now(), status: st, note: "Status updated" });
  db.prepare("UPDATE orders SET customer_id=?, partner_id=?, delivery_address=?, items=?, customizations=?, status=?, notes=?, delivery_fee=?, subtotal=?, total=?, events=? WHERE id=?")
    .run(customerId, partnerId || null, deliveryAddress || null, json.stringify(items), json.stringify(Array.isArray(customizations) ? customizations : []), st, notes || null, fee, subtotal, total, json.stringify(events), req.params.id);
  const order = rowToOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id));
  if (prev.status !== "delivered" && st === "delivered") applyStockOnDelivered(order);
  logActivity(`Order #${req.params.id.slice(-6).toUpperCase()} updated`, "info", { orderId: req.params.id });
  res.json(order);
});

router.patch("/:id/status", (req, res) => {
  const { status } = req.body || {};
  if (!STAGES.includes(status)) return res.status(400).json({ error: "Invalid status" });
  const prev = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!prev) return res.status(404).json({ error: "Not found" });
  if (prev.status === status) return res.json(rowToOrder(prev));
  const events = json.parse(prev.events, []);
  events.unshift({ at: Date.now(), status, note: "Status updated" });
  db.prepare("UPDATE orders SET status = ?, events = ? WHERE id = ?")
    .run(status, json.stringify(events), req.params.id);
  const order = rowToOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id));
  if (prev.status !== "delivered" && status === "delivered") applyStockOnDelivered(order);
  logActivity(`Order #${req.params.id.slice(-6).toUpperCase()} → ${status}`, "info", { orderId: req.params.id });
  res.json(order);
});

router.patch("/:id/partner", (req, res) => {
  const { partnerId } = req.body || {};
  db.prepare("UPDATE orders SET partner_id = ? WHERE id = ?").run(partnerId || null, req.params.id);
  res.json(rowToOrder(db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM orders WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
