/* =========================================================================
   DabbaBox Tiffin CRM — Express server
   ========================================================================= */
const path = require("path");
const fs = require("fs");

// Tiny .env loader (no dependency)
(function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  fs.readFileSync(envPath, "utf8").split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx < 0) return;
    const k = trimmed.slice(0, idx).trim();
    let v = trimmed.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  });
})();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const { db, asyncLocalStorage, getTenantDb } = require("./db");
const { ensureDefaultAdmin, requireAuth } = require("./auth");
const seed = require("./seed");

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";

const app = express();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    return cb(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true })); // for Twilio webhook

// Log requests
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/")) console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Database context middleware
app.use((req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  let tenantId = null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (decoded && decoded.tenant_id) {
        tenantId = decoded.tenant_id;
      }
    } catch (e) {
      // Ignore token validation errors here, requireAuth handles 401s
    }
  }

  const activeDb = getTenantDb(tenantId);
  asyncLocalStorage.run({ db: activeDb, tenantId }, () => {
    next();
  });
});

/* ---- API routes ---- */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/superadmin", require("./routes/superadmin"));
app.use("/api/customers", require("./routes/customers"));
app.use("/api/products", require("./routes/products"));
app.use("/api/partners", require("./routes/partners"));
app.use("/api/orders", require("./routes/orders"));
app.use("/api/subscriptions", require("./routes/subscriptions"));
app.use("/api/leads", require("./routes/leads"));
app.use("/api/whatsapp", require("./routes/whatsapp"));
app.use("/api/reports", require("./routes/reports"));
app.use("/api/settings", require("./routes/settings"));

app.get("/api/health", (_req, res) => res.json({ ok: true, time: Date.now() }));

/* ---- Serve frontend (static) ---- */
const frontendDir = path.join(__dirname, "..", "frontend");
if (fs.existsSync(frontendDir)) {
  app.use(express.static(frontendDir));
  app.get("/", (_req, res) => res.sendFile(path.join(frontendDir, "index.html")));
  app.get("/login", (_req, res) => res.sendFile(path.join(frontendDir, "login.html")));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(frontendDir, "index.html")));
}

/* ---- Bootstrap ---- */
const defaultDb = getTenantDb("default");
asyncLocalStorage.run({ db: defaultDb, tenantId: "default" }, () => {
  ensureDefaultAdmin();
  const customerCount = db.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
  if (customerCount === 0) {
    console.log("Seeding demo data for default tenant…");
    seed();
  }
});

app.listen(PORT, () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║   🍱  DabbaBox Tiffin CRM — running                 ║");
  console.log(`║   http://localhost:${String(PORT).padEnd(31)} ║`);
  console.log("║   API:   http://localhost:" + PORT + "/api                  ".slice(0, 24 - String(PORT).length) + "║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("");
});
