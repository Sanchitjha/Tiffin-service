const express = require("express");
const router = express.Router();
const { signToken, verifyPassword, findUserByEmail, createUser, requireAuth, hashPassword } = require("../auth");
const { db, systemDb } = require("../db");

router.post("/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password required" });
  const u = findUserByEmail(email);
  if (!u || !verifyPassword(password, u.password)) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken(u);
  res.json({ token, user: { id: u.id, email: u.email, name: u.name, role: u.role, tenantId: u.tenant_id } });
});

router.get("/me", requireAuth, (req, res) => {
  const u = systemDb.prepare("SELECT id, email, name, role, tenant_id FROM users WHERE id = ?").get(req.user.id);
  if (!u) return res.status(404).json({ error: "User not found" });
  res.json({ id: u.id, email: u.email, name: u.name, role: u.role, tenantId: u.tenant_id });
});

router.post("/change-password", requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords required" });
  if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 chars" });
  const u = systemDb.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!u || !verifyPassword(currentPassword, u.password)) return res.status(401).json({ error: "Current password incorrect" });
  systemDb.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword(newPassword), u.id);
  res.json({ ok: true });
});

module.exports = router;
