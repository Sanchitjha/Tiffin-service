const express = require("express");
const router = express.Router();
const { db, uid, rowToPartner, rowToOrder } = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM partners ORDER BY name COLLATE NOCASE").all().map(rowToPartner));
});

router.get("/:id", (req, res) => {
  const p = db.prepare("SELECT * FROM partners WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const orders = db.prepare("SELECT * FROM orders WHERE partner_id = ? ORDER BY created_at DESC").all(p.id);
  res.json({ ...rowToPartner(p), orders: orders.map(rowToOrder) });
});

router.post("/", (req, res) => {
  const { name, phone, area, vehicle, active } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const id = uid("dp_");
  db.prepare("INSERT INTO partners (id, name, phone, area, vehicle, active) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, name, phone || null, area || null, vehicle || "Bike", active === false ? 0 : 1);
  res.json(rowToPartner(db.prepare("SELECT * FROM partners WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const { name, phone, area, vehicle, active } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  db.prepare("UPDATE partners SET name=?, phone=?, area=?, vehicle=?, active=? WHERE id=?")
    .run(name, phone || null, area || null, vehicle || "Bike", active === false ? 0 : 1, req.params.id);
  res.json(rowToPartner(db.prepare("SELECT * FROM partners WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM partners WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
