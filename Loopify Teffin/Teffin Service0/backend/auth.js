/* =========================================================================
   Authentication — bcrypt + JWT
   ========================================================================= */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { uid, systemDb } = require("./db");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES = "30d";

function hashPassword(plain) { return bcrypt.hashSync(plain, 10); }
function verifyPassword(plain, hash) { return bcrypt.compareSync(plain, hash); }
function signToken(user) { 
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id }, 
    JWT_SECRET, 
    { expiresIn: JWT_EXPIRES }
  ); 
}

/* ---- Middleware ---- */
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token && req.query.token) token = req.query.token;
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
  return systemDb.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
}
function createUser({ email, name, password, role = "admin", tenantId = null }) {
  const id = uid("u_");
  systemDb.prepare("INSERT INTO users (id, email, name, password, role, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, email.toLowerCase(), name, hashPassword(password), role, tenantId, Date.now());
  return { id, email, name, role, tenantId };
}

/* ---- Seed default admin if no users exist ---- */
function ensureDefaultAdmin() {
  const count = systemDb.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (count > 0) return null;
  
  // Seed default tenant first
  systemDb.prepare(`
    INSERT OR IGNORE INTO tenants (id, business_name, owner_name, email, phone, city, area, whatsapp_number, status, plan, trial_ends_at, whatsapp_markup_rate, created_at)
    VALUES ('default', 'DabbaBox Tiffin Service', 'Admin', 'admin@dabbabox.in', '+91 98765 00000', 'Surat', 'Adajan', '+919876500001', 'active', 'monthly', NULL, 0.05, ?)
  `).run(Date.now());

  // Create default admin user (tenant_id = 'default')
  const email = process.env.ADMIN_EMAIL || "admin@dabbabox.in";
  const password = process.env.ADMIN_PASSWORD || "dabbabox@2026";
  const u = createUser({ email, name: "Admin", password, role: "admin", tenantId: "default" });
  console.log(`✓ Default admin created: ${email} / ${password} (change after first login)`);

  // Create default super admin user (tenant_id = null)
  const saEmail = "superadmin@dabbabox.in";
  const saPassword = "superadmin@2026";
  createUser({ email: saEmail, name: "Super Admin", password: saPassword, role: "superadmin", tenantId: null });
  console.log(`✓ Default super admin created: ${saEmail} / ${saPassword}`);

  return u;
}

module.exports = { requireAuth, signToken, verifyPassword, findUserByEmail, createUser, ensureDefaultAdmin, hashPassword };
