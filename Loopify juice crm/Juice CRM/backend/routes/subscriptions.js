const express = require("express");
const router = express.Router();
const { db, uid, json, rowToSubscription } = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

router.get("/", (req, res) => {
  const { customerId } = req.query;
  let sql = "SELECT * FROM subscriptions";
  const args = [];
  if (customerId) { sql += " WHERE customer_id = ?"; args.push(customerId); }
  sql += " ORDER BY next_delivery";
  res.json(db.prepare(sql).all(...args).map(rowToSubscription));
});

router.post("/", (req, res) => {
  const { name, customerId, frequency, status, nextDelivery, items } = req.body || {};
  if (!name || !customerId) return res.status(400).json({ error: "name and customerId required" });
  const id = uid("s_");
  db.prepare("INSERT INTO subscriptions (id, name, customer_id, frequency, status, next_delivery, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, name, customerId, frequency || "weekly", status || "active", nextDelivery || null, json.stringify(items || []), Date.now());
  res.json(rowToSubscription(db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const { name, customerId, frequency, status, nextDelivery, items } = req.body || {};
  if (!name || !customerId) return res.status(400).json({ error: "name and customerId required" });
  db.prepare("UPDATE subscriptions SET name=?, customer_id=?, frequency=?, status=?, next_delivery=?, items=? WHERE id=?")
    .run(name, customerId, frequency || "weekly", status || "active", nextDelivery || null, json.stringify(items || []), req.params.id);
  res.json(rowToSubscription(db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(req.params.id)));
});

router.patch("/:id/toggle", (req, res) => {
  const s = db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(req.params.id);
  if (!s) return res.status(404).json({ error: "Not found" });
  const newStatus = s.status === "active" ? "paused" : "active";
  db.prepare("UPDATE subscriptions SET status = ? WHERE id = ?").run(newStatus, req.params.id);
  res.json(rowToSubscription(db.prepare("SELECT * FROM subscriptions WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM subscriptions WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
