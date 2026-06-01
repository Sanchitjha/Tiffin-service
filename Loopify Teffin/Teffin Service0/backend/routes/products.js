const express = require("express");
const router = express.Router();
const { db, uid, rowToProduct } = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

router.get("/", (req, res) => {
  res.json(db.prepare("SELECT * FROM products ORDER BY name COLLATE NOCASE").all().map(rowToProduct));
});

router.get("/:id", (req, res) => {
  const p = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  const moves = db.prepare("SELECT * FROM stock_moves WHERE product_id = ? ORDER BY at DESC LIMIT 20").all(p.id);
  res.json({ ...rowToProduct(p), stockMoves: moves });
});

router.post("/", (req, res) => {
  const { name, emoji, category, price, stock, lowStockAt, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const id = uid("p_");
  db.prepare("INSERT INTO products (id, name, emoji, category, price, stock, low_stock_at, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, name, emoji || "🍱", category || null, Number(price) || 0, parseInt(stock) || 0, parseInt(lowStockAt) || 5, description || null);
  res.json(rowToProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(id)));
});

router.put("/:id", (req, res) => {
  const { name, emoji, category, price, stock, lowStockAt, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const prev = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!prev) return res.status(404).json({ error: "Not found" });
  const newStock = parseInt(stock) || 0;
  db.prepare("UPDATE products SET name=?, emoji=?, category=?, price=?, stock=?, low_stock_at=?, description=? WHERE id=?")
    .run(name, emoji || "🍱", category || null, Number(price) || 0, newStock, parseInt(lowStockAt) || 5, description || null, req.params.id);
  if (prev.stock !== newStock) {
    db.prepare("INSERT INTO stock_moves (id, product_id, delta, reason, at) VALUES (?, ?, ?, ?, ?)")
      .run(uid("sm_"), req.params.id, newStock - prev.stock, "Manual stock adjustment", Date.now());
  }
  res.json(rowToProduct(db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id)));
});

router.delete("/:id", (req, res) => {
  db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
