const express = require("express");
const router = express.Router();
const { db, json } = require("../db");
const { requireAuth } = require("../auth");
const seed = require("../seed");

router.use(requireAuth);

router.get("/", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const out = {};
  rows.forEach(r => out[r.key] = json.parse(r.value, null));
  res.json(out);
});

router.put("/:key", (req, res) => {
  const value = req.body && req.body.value;
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(req.params.key, json.stringify(value));
  res.json({ key: req.params.key, value });
});

/* ---- Backup: download all data as JSON ---- */
const BACKUP_TABLES = ["customers","products","partners","orders","subscriptions","leads","whatsapp_messages","stock_moves","activity","settings"];

router.get("/backup/download", (req, res) => {
  const dump = { _meta: { generatedAt: Date.now(), version: 1 } };
  for (const t of BACKUP_TABLES) dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="dabbabox-backup-${new Date().toISOString().slice(0,10)}.json"`);
  res.send(JSON.stringify(dump, null, 2));
});

/* ---- Restore: wipe and reload from JSON ---- */
router.post("/backup/restore", (req, res) => {
  const data = req.body;
  if (!data || typeof data !== "object") return res.status(400).json({ error: "Invalid backup payload" });
  const tx = db.transaction(() => {
    for (const t of BACKUP_TABLES) db.prepare(`DELETE FROM ${t}`).run();
    for (const t of BACKUP_TABLES) {
      const rows = Array.isArray(data[t]) ? data[t] : [];
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => "?").join(",");
      const stmt = db.prepare(`INSERT INTO ${t} (${cols.join(",")}) VALUES (${placeholders})`);
      for (const row of rows) stmt.run(...cols.map(c => row[c]));
    }
  });
  try { tx(); res.json({ ok: true, restored: BACKUP_TABLES.reduce((s, t) => s + (Array.isArray(data[t]) ? data[t].length : 0), 0) }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

/* ---- Reset: wipe + reseed demo data ---- */
router.post("/reset", (req, res) => {
  const tx = db.transaction(() => { for (const t of BACKUP_TABLES) db.prepare(`DELETE FROM ${t}`).run(); });
  tx();
  seed();
  res.json({ ok: true });
});

module.exports = router;
