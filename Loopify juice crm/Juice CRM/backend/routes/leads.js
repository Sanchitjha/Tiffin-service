const express = require("express");
const router = express.Router();
const { db, uid, json, rowToLead, rowToCustomer } = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all().map(rowToLead));
});

router.post("/", (req, res) => {
  const { name, phone, source, stage, followUp, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const id = uid("l_");
  db.prepare("INSERT INTO leads (id, name, phone, source, stage, follow_up, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, name, phone || null, source || null, stage || "new", followUp || null, notes || null, Date.now());
  res.json(rowToLead(db.prepare("SELECT * FROM leads WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const { name, phone, source, stage, followUp, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  db.prepare("UPDATE leads SET name=?, phone=?, source=?, stage=?, follow_up=?, notes=? WHERE id=?")
    .run(name, phone || null, source || null, stage || "new", followUp || null, notes || null, req.params.id);
  res.json(rowToLead(db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id)));
});

router.patch("/:id/stage", (req, res) => {
  const { stage } = req.body || {};
  db.prepare("UPDATE leads SET stage = ? WHERE id = ?").run(stage, req.params.id);
  res.json(rowToLead(db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id)));
});

router.post("/:id/convert", (req, res) => {
  const l = db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id);
  if (!l) return res.status(404).json({ error: "Not found" });
  const cid = uid("c_");
  db.prepare("INSERT INTO customers (id, name, phone, email, area, address, tags, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(cid, l.name, l.phone || null, null, null, null, json.stringify(["from-lead", l.source].filter(Boolean)), l.notes || null, Date.now());
  db.prepare("UPDATE leads SET stage = 'converted' WHERE id = ?").run(req.params.id);
  res.json({ customer: rowToCustomer(db.prepare("SELECT * FROM customers WHERE id = ?").get(cid)), lead: rowToLead(db.prepare("SELECT * FROM leads WHERE id = ?").get(req.params.id)) });
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM leads WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
