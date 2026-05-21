let WA_SELECTED = null, WA_MSGS = [];
const WA_TEMPLATES = [
  "Hi! Thanks for reaching out to DabbaBox Tiffin Service 🍱",
  "Our monthly tiffin plan starts at ₹3,299. Shall I share the full menu?",
  "Your tiffin is being packed — out for delivery soon!",
  "Freshly cooked every day — no preservatives, home-style meals!",
  "Could you share your area? We deliver across the city.",
  "Do you prefer Veg, Non-Veg, or Jain tiffin?",
];

function pageWhatsapp() {
  const threads = State.whatsappThreads;
  if (!threads.length) {
    return `<div class="card"><div style="padding:60px 20px;text-align:center"><div class="empty-icon" style="margin:0 auto 16px">${ic("message", 28)}</div><div class="empty-title">No WhatsApp messages yet</div><div class="empty-sub">When your bot receives messages on the webhook URL, they stream in here. Convert any chat to a lead, customer, or order.</div><div style="margin-top:18px"><button class="btn btn-primary" onclick="simulateWhatsApp()">${ic("zap", 13)}<span>Simulate incoming message</span></button></div><div style="margin-top:24px;font-size:11.5px;color:var(--c-muted-2);max-width:480px;margin-left:auto;margin-right:auto">Bot webhook URL: <code class="mono" style="background:var(--c-surface-2);padding:2px 6px;border-radius:4px">POST /api/whatsapp/webhook</code></div></div></div>`;
  }
  if (!WA_SELECTED || !threads.find(t => t.phone === WA_SELECTED)) WA_SELECTED = threads[0].phone;
  const sel = threads.find(t => t.phone === WA_SELECTED);
  // Load messages lazily for the selected thread
  if (!WA_MSGS.length || WA_MSGS[0]?.phone !== sel.phone) {
    API.whatsapp.messages(sel.phone).then(msgs => { WA_MSGS = msgs; renderWaConv(sel, msgs); API.whatsapp.markRead(sel.phone).then(() => App.refresh().then(() => renderNav())); });
  }
  return `
    <div class="page-header"><div><div class="page-h1">WhatsApp inbox</div><div class="page-h1-sub">${threads.length} conversations • ${threads.reduce((s, t) => s + t.unread, 0)} unread</div></div><button class="btn btn-secondary" onclick="simulateWhatsApp()">${ic("zap", 13)}<span>Simulate incoming</span></button></div>
    <div class="wa-grid">
      <div class="wa-threads">
        <div style="flex:1;overflow-y:auto" class="scroll">${threads.map(t => { const displayName = t.customer ? t.customer.name : (t.name || t.phone); return `<div class="wa-thread ${t.phone === sel.phone ? "active" : ""}" onclick="selectWaThread('${t.phone}')">
          <div class="avatar ${avClass(displayName)}">${initials(displayName)}</div>
          <div class="flex-1" style="min-width:0">
            <div class="between"><div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(displayName)}</div>${t.unread ? `<span class="chip" style="background:var(--c-brand);color:#fff;border:none">${t.unread}</span>` : ""}</div>
            <div class="muted" style="font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.lastDir === "out" ? "You: " : ""}${esc(t.lastText)}</div>
            <div class="muted" style="font-size:10.5px;margin-top:2px">${fmtTime(t.lastAt)}</div>
          </div></div>`; }).join("")}
        </div>
      </div>
      <div class="wa-conv" id="waConv"><div class="card-pad muted" style="text-align:center;padding:40px">Loading…</div></div>
    </div>`;
}

function renderWaConv(sel, msgs) {
  const conv = document.getElementById("waConv"); if (!conv) return;
  const displayName = sel.customer ? sel.customer.name : (sel.name || sel.phone);
  conv.innerHTML = `
    <div class="wa-conv-head">
      <div class="row"><div class="avatar ${avClass(displayName)}" style="width:38px;height:38px">${initials(displayName)}</div>
        <div><div style="font-weight:600;font-size:14px">${esc(displayName)}</div><div class="muted mono" style="font-size:11.5px">${esc(sel.phone)} ${sel.customer ? '• <span style="color:var(--c-success);font-family:Inter">existing customer</span>' : '• <span style="color:var(--c-muted);font-family:Inter">new contact</span>'}</div></div>
      </div>
      <div class="row-tight">${!sel.customer ? `<button class="btn btn-secondary btn-sm" onclick="waCreateCustomer('${sel.phone}')">${ic("plus", 12)}<span>Save contact</span></button>` : ""}${!sel.customer ? `<button class="btn btn-secondary btn-sm" onclick="waCreateLead('${sel.phone}')">${ic("target", 12)}<span>Create lead</span></button>` : ""}${sel.customer ? `<button class="btn btn-primary btn-sm" onclick="openOrderForm(null,'${sel.customer.id}')">${ic("plus", 12)}<span>New order</span></button>` : ""}</div>
    </div>
    <div class="wa-msgs scroll" id="waMsgs">${msgs.map(m => `<div class="wa-msg ${m.dir}"><div>${esc(m.text)}</div><div class="ts">${fmtTime(m.at)}</div></div>`).join("")}</div>
    <div class="wa-templates">${WA_TEMPLATES.map(t => `<button class="chip" style="cursor:pointer;background:transparent" onclick="document.getElementById('waReply').value=${JSON.stringify(t)};document.getElementById('waReply').focus()">${esc(t.length > 40 ? t.slice(0, 40) + "…" : t)}</button>`).join("")}</div>
    <div class="wa-compose"><input id="waReply" class="input flex-1" placeholder="Type a reply…" onkeydown="if(event.key==='Enter')waSendReply('${sel.phone}')"/><button class="btn btn-primary" onclick="waSendReply('${sel.phone}')">${ic("send", 13)}<span>Send</span></button></div>
  `;
  const m = document.getElementById("waMsgs"); if (m) m.scrollTop = m.scrollHeight;
}

async function selectWaThread(phone) {
  WA_SELECTED = phone; WA_MSGS = [];
  try {
    const [msgs] = await Promise.all([ API.whatsapp.messages(phone), API.whatsapp.markRead(phone) ]);
    WA_MSGS = msgs;
    const sel = State.whatsappThreads.find(t => t.phone === phone);
    if (sel) renderWaConv(sel, msgs);
    await App.refresh(); renderNav();
    // re-render thread list to clear unread badge
    document.querySelectorAll(".wa-thread").forEach(el => el.classList.toggle("active", false));
  } catch (e) { UI.toast(e.message, "error"); }
}

async function waSendReply(phone) {
  const inp = document.getElementById("waReply"); const text = inp.value.trim(); if (!text) return;
  try { await API.whatsapp.reply(phone, text); inp.value = ""; const msgs = await API.whatsapp.messages(phone); WA_MSGS = msgs; const sel = State.whatsappThreads.find(t => t.phone === phone); renderWaConv(sel, msgs); await App.refresh(); }
  catch (e) { UI.toast(e.message, "error"); }
}
async function simulateWhatsApp() {
  try { await API.whatsapp.simulate(); UI.toast("New WhatsApp message", "success"); await App.refresh(); if (State.route !== "whatsapp") App.go("whatsapp"); else App.render(); renderNav(); }
  catch (e) { UI.toast(e.message, "error"); }
}
async function waCreateCustomer(phone) {
  const thread = State.whatsappThreads.find(t => t.phone === phone);
  const name = prompt("Customer name", thread?.name || ""); if (!name) return;
  try { await API.customers.create({ name, phone }); UI.toast("Customer saved", "success"); await App.refresh(); App.render(); renderNav(); }
  catch (e) { UI.toast(e.message, "error"); }
}
async function waCreateLead(phone) {
  const thread = State.whatsappThreads.find(t => t.phone === phone);
  const body = { name: thread?.name || phone, phone, source: "WhatsApp Bot", stage: "new", followUp: daysFromNow(1), notes: thread?.lastText || "" };
  try { await API.leads.create(body); UI.toast("Lead created", "success"); await App.refresh(); App.render(); renderNav(); }
  catch (e) { UI.toast(e.message, "error"); }
}
