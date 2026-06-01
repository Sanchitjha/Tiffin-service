/* Utility helpers shared across pages */
const fmtINR     = n => "₹" + (Number(n || 0)).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const fmtDate    = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtShort   = d => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";
const fmtTime    = d => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const todayISO   = () => new Date().toISOString().slice(0, 10);
const isoDate    = ms => new Date(ms).toISOString().slice(0, 10);
const daysFromNow = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const esc        = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials   = name => String(name || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const avClass    = name => { const x = String(name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0); return "av-" + ((x % 6) + 1); };
const phoneClean = p => (p || "").replace(/\D/g, "");
const debounce   = (fn, wait = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; };

function sortBy(arr, key, dir) {
  const k = typeof key === "function" ? key : x => x[key];
  return arr.slice().sort((a, b) => {
    const av = k(a), bv = k(b);
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return dir === "desc" ? bv - av : av - bv;
    return dir === "desc" ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
  });
}
function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function downloadFile(name, content, type = "text/plain") {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function parseCsvRow(line) {
  const out = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === ",") { out.push(cur); cur = ""; }
      else if (ch === '"') inQ = true;
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}
