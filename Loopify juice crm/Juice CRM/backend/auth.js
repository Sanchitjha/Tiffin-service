/* =========================================================================
   Authentication — bcrypt + JWT
   ========================================================================= */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { db, uid } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES = "30d";

function hashPassword(plain) { return bcrypt.hashSync(plain, 10); }
function verifyPassword(plain, hash) { return bcrypt.compareSync(plain, hash); }
function signToken(user) { return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES }); }

/* ---- Middleware ---- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/* ---- User helpers ---- */
function findUserByEmail(email) {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
}
function createUser({ email, name, password, role = "admin" }) {
  const id = uid("u_");
  db.prepare("INSERT INTO users (id, email, name, password, role, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email.toLowerCase(), name, hashPassword(password), role, Date.now());
  return { id, email, name, role };
}

/* ---- Seed default admin if no users exist ---- */
function ensureDefaultAdmin() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return null;
  const email = process.env.ADMIN_EMAIL || "admin@dabbabox.in";
  const password = process.env.ADMIN_PASSWORD || "dabbabox@2026";
  const u = createUser({ email, name: "Admin", password, role: "admin" });
  console.log(`✓ Default admin created: ${email} / ${password}  (change after first login)`);
  return u;
}

module.exports = { requireAuth, signToken, verifyPassword, findUserByEmail, createUser, ensureDefaultAdmin, hashPassword };
