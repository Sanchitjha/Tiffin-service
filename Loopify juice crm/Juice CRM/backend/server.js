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

const { db } = require("./db");
const { ensureDefaultAdmin } = require("./auth");
const seed = require("./seed");

const PORT = process.env.PORT || 4000;

const app = express();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    // Allow all origins dynamically to prevent CORS blockages during deployment/demo
    return cb(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true })); // for Twilio webhook
app.use((req, _res, next) => {
  if (req.path.startsWith("/api/")) console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

/* ---- API routes ---- */
app.use("/api/auth", require("./routes/auth"));
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
  // Catch-all for SPA-style routes (fallback to index.html)
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(frontendDir, "index.html")));
}

/* ---- Bootstrap ---- */
ensureDefaultAdmin();
const customerCount = db.prepare("SELECT COUNT(*) AS c FROM customers").get().c;
if (customerCount === 0) {
  console.log("Seeding demo data…");
  seed();
}

app.listen(PORT, () => {
  console.log("");
  console.log("╔════════════════════════════════════════════════════╗");
  console.log("║   🍱  DabbaBox Tiffin CRM — running                 ║");
  console.log(`║   http://localhost:${String(PORT).padEnd(31)} ║`);
  console.log("║   API:   http://localhost:" + PORT + "/api                  ".slice(0, 24 - String(PORT).length) + "║");
  console.log("╚════════════════════════════════════════════════════╝");
  console.log("");
});
