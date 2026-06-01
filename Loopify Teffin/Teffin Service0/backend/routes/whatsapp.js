const express = require("express");
const router = express.Router();
const { db, uid, rowToWa, systemDb, asyncLocalStorage, getTenantDb } = require("../db");
const { requireAuth } = require("../auth");
const { generateBotReply } = require("../chatbot");

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || "dabbabox-verify-token-2026";

function getRecipientNumber(body) {
  try {
    if (body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value && body.entry[0].changes[0].value.metadata) {
      const num = body.entry[0].changes[0].value.metadata.display_phone_number;
      if (num) return "+" + num.replace(/\D/g, "");
    }
  } catch {}
  if (body.To) return String(body.To).replace(/^whatsapp:/i, "").trim();
  if (body.recipientPhone) return body.recipientPhone;
  return null;
}

/* ===========================================================
   PUBLIC WEBHOOK — point your WhatsApp bot/provider here
   GET  /api/whatsapp/webhook   (verification handshake)
   POST /api/whatsapp/webhook   (incoming messages)
   Compatible with Meta Cloud API & Twilio Webhook format.
   =========================================================== */

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✓ WhatsApp webhook verified");
    return res.status(200).send(challenge);
  }
  res.status(403).json({ error: "Forbidden" });
});

router.post("/webhook", async (req, res) => {
  const body = req.body || {};
  const recipientNum = getRecipientNumber(body);
  let tenantId = "default";
  
  if (recipientNum) {
    const t = systemDb.prepare("SELECT id FROM tenants WHERE whatsapp_number = ?").get(recipientNum);
    if (t) tenantId = t.id;
  }

  const activeDb = getTenantDb(tenantId);
  await asyncLocalStorage.run({ db: activeDb, tenantId }, async () => {
    const messages = parseInbound(body);
    for (const m of messages) {
      db.prepare("INSERT INTO whatsapp_messages (id, phone, name, direction, text, unread, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(uid("m_"), m.phone, m.name || null, "in", m.text, 1, Date.now());
      console.log(`[Tenant: ${tenantId}] 📩 WA in from ${m.phone}: ${m.text.slice(0, 60)}`);

      // Track incoming WhatsApp API message usage
      systemDb.prepare(`
        INSERT INTO whatsapp_api_usage (id, tenant_id, direction, type, cost, at)
        VALUES (?, ?, 'in', 'service', 0.05, ?)
      `).run(uid("wa_"), tenantId, Date.now());

      // --- Chatbot Integration ---
      try {
        const replyText = await generateBotReply(m);
        if (replyText) {
          console.log(`🤖 Bot reply for ${m.phone} in tenant ${tenantId}`);
          const replyId = uid("m_");
          db.prepare("INSERT INTO whatsapp_messages (id, phone, name, direction, text, unread, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(replyId, m.phone, null, "out", replyText, 0, Date.now());
          
          // Track outgoing WhatsApp API message usage
          systemDb.prepare(`
            INSERT INTO whatsapp_api_usage (id, tenant_id, direction, type, cost, at)
            VALUES (?, ?, 'out', 'service', 0.05, ?)
          `).run(uid("wa_"), tenantId, Date.now());

          const provider = await sendViaTwilio(m.phone, replyText);
          if (provider.sent) {
            console.log(`📤 WA sent via Twilio to ${m.phone} (SID: ${provider.sid})`);
          } else {
            console.log(`📝 WA bot reply stored locally for ${m.phone} (${provider.reason})`);
          }
        }
      } catch (err) {
        console.error("Chatbot processing error:", err);
      }
    }
    res.status(200).json({ ok: true, received: messages.length });
  });
});

/* Try to handle both Meta Cloud and Twilio inbound formats */
function parseInbound(body) {
  const out = [];
  // Meta Cloud API
  if (body.entry && Array.isArray(body.entry)) {
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      for (const ch of changes) {
        const v = ch.value || {};
        const contacts = v.contacts || [];
        for (const msg of v.messages || []) {
          const contact = contacts.find(c => c.wa_id === msg.from);
          out.push({
            phone: "+" + msg.from,
            name: contact?.profile?.name || null,
            text: msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || "[non-text message]",
          });
        }
      }
    }
  }
  // Twilio format: { From: 'whatsapp:+91...', Body: '...', ProfileName: '...' }
  if (body.From && body.Body) {
    out.push({
      phone: String(body.From).replace(/^whatsapp:/i, ""),
      name: body.ProfileName || null,
      text: body.Body,
    });
  }
  // Generic: { phone, name, text } — useful for our own bots
  if (body.phone && body.text) {
    out.push({ phone: body.phone, name: body.name || null, text: body.text });
  }
  return out;
}

/* ===========================================================
   AUTHENTICATED API (consumed by the CRM frontend)
   =========================================================== */

router.get("/threads", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM whatsapp_messages ORDER BY at DESC").all();
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.phone)) map.set(r.phone, { phone: r.phone, name: r.name, lastAt: r.at, lastText: r.text, lastDir: r.direction, unread: 0 });
    if (r.unread) map.get(r.phone).unread++;
  }
  // attach customer match
  const customers = db.prepare("SELECT id, name, phone FROM customers").all();
  const phoneClean = p => (p || "").replace(/\D/g, "");
  const list = Array.from(map.values()).map(t => {
    const cu = customers.find(c => phoneClean(c.phone) === phoneClean(t.phone));
    return { ...t, customer: cu || null };
  }).sort((a, b) => b.lastAt - a.lastAt);
  res.json(list);
});

router.get("/messages", requireAuth, (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: "phone required" });
  const rows = db.prepare("SELECT * FROM whatsapp_messages WHERE phone = ? ORDER BY at ASC").all(phone);
  res.json(rows.map(rowToWa));
});

async function sendViaTwilio(phone, text) {
  const sid = process.env.TWILIO_SID;
  const tok = process.env.TWILIO_TOKEN;
  const from = process.env.TWILIO_FROM; // e.g. whatsapp:+14155238886
  if (!sid || !tok || !from) return { sent: false, reason: "Twilio not configured" };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = new URLSearchParams({
    From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
    To: `whatsapp:${phone}`,
    Body: text,
  });
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${sid}:${tok}`).toString("base64"),
      },
      body,
    });
    const data = await r.json();
    if (!r.ok) return { sent: false, reason: data.message || `HTTP ${r.status}` };
    return { sent: true, sid: data.sid };
  } catch (e) {
    return { sent: false, reason: e.message };
  }
}

router.post("/reply", requireAuth, async (req, res) => {
  const { phone, text } = req.body || {};
  if (!phone || !text) return res.status(400).json({ error: "phone and text required" });
  const id = uid("m_");
  db.prepare("INSERT INTO whatsapp_messages (id, phone, name, direction, text, unread, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, phone, null, "out", text, 0, Date.now());
  // Try to actually send through Twilio if configured. Otherwise the message is stored locally.
  const provider = await sendViaTwilio(phone, text);
  if (provider.sent) console.log(`📤 WA sent via Twilio to ${phone} (SID: ${provider.sid})`);
  else console.log(`📝 WA reply stored locally for ${phone} (${provider.reason})`);
  const out = rowToWa(db.prepare("SELECT * FROM whatsapp_messages WHERE id = ?").get(id));
  res.json({ ...out, provider });
});

router.post("/mark-read", requireAuth, (req, res) => {
  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: "phone required" });
  db.prepare("UPDATE whatsapp_messages SET unread = 0 WHERE phone = ? AND unread = 1").run(phone);
  res.json({ ok: true });
});

router.post("/simulate", requireAuth, (req, res) => {
  const samples = [
    { name: "Aarav Sharma",  phone: "+919876512345", text: "Hi, do you deliver tiffin to Adajan?" },
    { name: "Priya Menon",   phone: "+919812345678", text: "I want a monthly tiffin subscription. Do you have a Jain option?" },
    { name: "Rohan Verma",   phone: "+918888812345", text: "My tiffin hasn't arrived yet — it's already 1 PM." },
    { name: "Sanya Iyer",    phone: "+919900099001", text: "Is the food freshly cooked every day or pre-packed?" },
    { name: "Karan Patel",   phone: "+917777123456", text: "Need 25 tiffins daily for our office in Vesu. What are bulk rates?" },
  ];
  const s = samples[Math.floor(Math.random() * samples.length)];
  const id = uid("m_");
  db.prepare("INSERT INTO whatsapp_messages (id, phone, name, direction, text, unread, at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, s.phone, s.name, "in", s.text, 1, Date.now());
  res.json(rowToWa(db.prepare("SELECT * FROM whatsapp_messages WHERE id = ?").get(id)));
});

router.get("/unread-count", requireAuth, (req, res) => {
  const c = db.prepare("SELECT COUNT(*) AS c FROM whatsapp_messages WHERE unread = 1").get().c;
  res.json({ count: c });
});

module.exports = router;
