function pageSettings() {
  const b = State.business;
  const user = Auth.user();
  return `
    <div class="page-header"><div><div class="page-h1">Settings</div><div class="page-h1-sub">Business info, account, and appearance</div></div></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-head"><div class="card-title">Business information</div><div class="card-sub">Used on invoices</div></div>
        <div class="card-pad">
          <div class="field"><label class="lbl">Business name</label><input id="biz_name" class="input" value="${esc(b.name)}"/></div>
          <div class="field"><label class="lbl">Address</label><textarea id="biz_addr" class="textarea" rows="2">${esc(b.address)}</textarea></div>
          <div class="field-row">
            <div class="field"><label class="lbl">Phone</label><input id="biz_phone" class="input" value="${esc(b.phone)}"/></div>
            <div class="field"><label class="lbl">Email</label><input id="biz_email" class="input" value="${esc(b.email)}"/></div>
          </div>
          <div class="field"><label class="lbl">GSTIN (optional)</label><input id="biz_gst" class="input" value="${esc(b.gst || "")}"/></div>
          <button class="btn btn-primary" onclick="saveBusiness()">${ic("check", 13)}<span>Save business info</span></button>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">Account</div><div class="card-sub">Signed in as ${esc(user ? user.email : "")}</div></div>
        <div class="card-pad">
          <div class="field"><label class="lbl">Current password</label><input id="pw_cur" class="input" type="password"/></div>
          <div class="field"><label class="lbl">New password</label><input id="pw_new" class="input" type="password"/></div>
          <button class="btn btn-primary" onclick="changePassword()">${ic("check", 13)}<span>Change password</span></button>
          <div class="divider"></div>
          <div class="between" style="margin-bottom:14px">
            <div><div style="font-weight:600;font-size:13.5px">Dark mode</div><div class="muted" style="font-size:12px">Switch between light and dark themes</div></div>
            <label class="switch"><input type="checkbox" ${State.theme === "dark" ? "checked" : ""} onchange="UI.toggleTheme()"/><span class="slider"></span></label>
          </div>
          <button class="btn btn-secondary" onclick="Auth.logout()">Sign out</button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-head"><div class="card-title">WhatsApp integration</div><div class="card-sub">Point your bot webhook to this URL</div></div>
      <div class="card-pad">
        <div class="field"><label class="lbl">Webhook URL</label><div class="input mono" id="webhookUrl" style="user-select:all;cursor:text"></div><div class="hint">Configure this in Meta Cloud API or Twilio as your message webhook.</div></div>
        <div class="field"><label class="lbl">Verify token</label><div class="input mono">Set in backend/.env as <code>WHATSAPP_VERIFY_TOKEN</code></div></div>
        <div class="field"><div class="hint">To send outbound messages via Twilio, set <code>TWILIO_SID</code>, <code>TWILIO_TOKEN</code>, and <code>TWILIO_FROM</code> in <code>backend/.env</code>. Without these, replies are stored locally only.</div></div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Data management</div><div class="card-sub">Backup, restore, or reset</div></div>
      <div class="card-pad" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="downloadBackup()">${ic("download", 13)}<span>Download backup (JSON)</span></button>
        <button class="btn btn-secondary" onclick="document.getElementById('jsonImport').click()">${ic("upload", 13)}<span>Restore from backup</span></button>
        <input type="file" id="jsonImport" accept=".json" style="display:none" onchange="restoreBackup(event)"/>
        <button class="btn btn-secondary" onclick="exportCustomersCSV()">${ic("download", 13)}<span>Customers (CSV)</span></button>
        <button class="btn btn-secondary" onclick="exportOrdersCSV()">${ic("download", 13)}<span>Orders (CSV)</span></button>
        <div style="flex:1"></div>
        <button class="btn btn-danger" onclick="resetToDemo()">${ic("refresh", 13)}<span>Reset to demo data</span></button>
      </div>
      <div class="card-pad" style="border-top:1px solid var(--c-border);background:var(--c-surface-2);font-size:12px;color:var(--c-muted)">
        Records: ${State.customers.length} customers · ${State.orders.length} orders · ${State.subscriptions.length} subscriptions · ${State.products.length} products · ${State.leads.length} leads · ${State.partners.length} partners
      </div>
    </div>
  `;
}

async function downloadBackup() {
  try {
    const r = await fetch("/api/settings/backup/download", { headers: { Authorization: "Bearer " + localStorage.getItem("dabbabox_token") } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `dabbabox-backup-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    UI.toast("Backup downloaded", "success");
  } catch (e) { UI.toast("Backup failed: " + e.message, "error"); }
}

async function restoreBackup(ev) {
  const f = ev.target.files[0]; if (!f) return;
  let data;
  try { data = JSON.parse(await f.text()); }
  catch (e) { UI.toast("Invalid backup file", "error"); ev.target.value = ""; return; }
  UI.confirm("This will REPLACE all current data with the backup contents. Continue?", async () => {
    try {
      const res = await API.settings.restore(data);
      UI.toast(`Restored ${res.restored} records`, "success");
      await App.refresh(); App.render(); renderNav(); updateBellDot();
    } catch (e) { UI.toast("Restore failed: " + e.message, "error"); }
    ev.target.value = "";
  }, true);
}

function resetToDemo() {
  UI.confirm("This will wipe all data and reload the demo dataset. Continue?", async () => {
    try {
      await API.settings.reset();
      UI.toast("Demo data restored", "success");
      await App.refresh(); App.render(); renderNav(); updateBellDot();
    } catch (e) { UI.toast("Reset failed: " + e.message, "error"); }
  }, true);
}
pageSettings.after = function () {
  const el = document.getElementById("webhookUrl");
  if (el) el.textContent = location.origin + "/api/whatsapp/webhook";
};

async function saveBusiness() {
  const b = {
    name: document.getElementById("biz_name").value.trim(),
    address: document.getElementById("biz_addr").value.trim(),
    phone: document.getElementById("biz_phone").value.trim(),
    email: document.getElementById("biz_email").value.trim(),
    gst: document.getElementById("biz_gst").value.trim(),
  };
  try { await API.settings.set("business", b); State.business = b; UI.toast("Business info saved", "success"); }
  catch (e) { UI.toast(e.message, "error"); }
}
async function changePassword() {
  const cur = document.getElementById("pw_cur").value;
  const next = document.getElementById("pw_new").value;
  if (!cur || !next) { UI.toast("Both passwords required", "error"); return; }
  try { await API.auth.changePassword(cur, next); document.getElementById("pw_cur").value = ""; document.getElementById("pw_new").value = ""; UI.toast("Password updated", "success"); }
  catch (e) { UI.toast(e.message, "error"); }
}
