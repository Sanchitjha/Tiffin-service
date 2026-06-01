function pageSubscriptions() {
  const q = State.search;
  let list = State.subscriptions.slice();
  if (q) list = list.filter(s => { const cu = State.customers.find(c => c.id === s.customerId); return s.name.toLowerCase().includes(q) || (cu && cu.name.toLowerCase().includes(q)); });
  list = list.sort((a, b) => (a.nextDelivery || "").localeCompare(b.nextDelivery || ""));
  const active = State.subscriptions.filter(s => s.status === "active").length;
  const mrr = State.subscriptions.filter(s => s.status === "active").reduce((s, sub) => { const t = (sub.items || []).reduce((x, i) => x + i.qty * i.price, 0); const m = { daily: 30, weekly: 4, biweekly: 2, monthly: 1 }[sub.frequency] || 1; return s + t * m; }, 0);
  return `
    <div class="page-header"><div><div class="page-h1">Subscriptions</div><div class="page-h1-sub">${active} active • Est. MRR ${fmtINR(mrr)}</div></div><button class="btn btn-primary" onclick="openSubForm()">${ic("plus", 13)}<span>New subscription</span></button></div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard("Active", String(active), '<span class="muted" style="font-size:11.5px">recurring plans</span>', "repeat")}
      ${kpiCard("Paused", String(State.subscriptions.filter(s => s.status === "paused").length), '<span class="muted" style="font-size:11.5px">on hold</span>', "clock")}
      ${kpiCard("Est. MRR", fmtINR(mrr), '<span class="muted" style="font-size:11.5px">monthly recurring</span>', "trendUp")}
      ${kpiCard("Next 7 days", String(State.subscriptions.filter(s => s.status === "active" && s.nextDelivery && s.nextDelivery <= daysFromNow(7)).length), '<span class="muted" style="font-size:11.5px">deliveries due</span>', "calendar")}
    </div>
    <div class="card"><div class="table-scroll" style="max-height:calc(100vh - 360px);border:none;border-radius:var(--radius-lg)"><table class="table"><thead><tr><th>Plan</th><th>Customer</th><th>Frequency</th><th>Items</th><th>Next delivery</th><th>Status</th><th style="width:60px"></th></tr></thead><tbody>
    ${list.length ? list.map(s => { const cu = State.customers.find(c => c.id === s.customerId); const total = (s.items || []).reduce((x, i) => x + i.qty * i.price, 0); return `<tr onclick="openSubForm('${s.id}')">
      <td><div style="font-weight:600">${esc(s.name)}</div><div class="muted num" style="font-size:11.5px">${fmtINR(total)} / cycle</div></td>
      <td>${cu ? `<div class="row"><div class="avatar ${avClass(cu.name)}">${initials(cu.name)}</div><div><div style="font-weight:500;font-size:13px">${esc(cu.name)}</div><div class="muted mono" style="font-size:11.5px">${esc(cu.phone || "")}</div></div></div>` : '<span class="muted">—</span>'}</td>
      <td><span class="badge badge-purple">${esc(s.frequency)}</span></td>
      <td style="font-size:12px">${esc((s.items || []).map(i => i.qty + "× " + i.name).join(", "))}</td>
      <td>${fmtDate(s.nextDelivery)}</td>
      <td>${s.status === "active" ? '<span class="badge badge-success"><span class="dot"></span>Active</span>' : s.status === "paused" ? '<span class="badge badge-accent"><span class="dot"></span>Paused</span>' : '<span class="badge badge-danger"><span class="dot"></span>Cancelled</span>'}</td>
      <td>${s.status === "active" ? `<button class="icon-btn" onclick="event.stopPropagation();subTogglePause('${s.id}')" title="Pause">${ic("clock", 14)}</button>` : s.status === "paused" ? `<button class="icon-btn" onclick="event.stopPropagation();subTogglePause('${s.id}')" title="Resume">${ic("check", 14)}</button>` : ""}</td>
    </tr>`; }).join("") : `<tr><td colspan="7">${emptyState("repeat", "No subscriptions", "Recurring plans lock in steady revenue.", "New subscription", "openSubForm()")}</td></tr>`}
    </tbody></table></div></div>`;
}

async function subTogglePause(id) {
  try { await API.subscriptions.toggle(id); await App.refresh(); UI.toast("Subscription updated", "success"); App.render(); }
  catch (e) { UI.toast(e.message, "error"); }
}

function openSubForm(id, preCustomerId) {
  const s = id ? State.subscriptions.find(x => x.id === id) : { id: "", name: "Weekly Wellness Pack", customerId: preCustomerId || "", frequency: "weekly", items: [], status: "active", nextDelivery: daysFromNow(7) };
  if (id && !s) { UI.toast("Not found"); return; }
  UI.openModal(`
    <div class="modal-head"><div><div class="modal-title">${id ? "Edit subscription" : "New subscription"}</div><div class="modal-sub">Recurring delivery plan</div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="field"><label class="lbl">Plan name *</label><input id="f_name" class="input" value="${esc(s.name)}"/></div>
      <div class="field-row">
        <div class="field"><label class="lbl">Customer *</label><select id="f_cust" class="select"><option value="">— Select —</option>${State.customers.map(c => `<option value="${c.id}" ${c.id === s.customerId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl">Frequency</label><select id="f_freq" class="select">${["daily","weekly","biweekly","monthly"].map(f => `<option ${f === s.frequency ? "selected" : ""}>${f}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label class="lbl">Next delivery</label><input id="f_next" class="input" type="date" value="${esc(s.nextDelivery || "")}"/></div>
        <div class="field"><label class="lbl">Status</label><select id="f_status" class="select"><option value="active" ${s.status === "active" ? "selected" : ""}>Active</option><option value="paused" ${s.status === "paused" ? "selected" : ""}>Paused</option><option value="cancelled" ${s.status === "cancelled" ? "selected" : ""}>Cancelled</option></select></div>
      </div>
      <div class="field"><label class="lbl">Line items</label><div id="itemRows" style="display:flex;flex-direction:column;gap:6px"></div><button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="addItemRow()">${ic("plus", 12)}<span>Add item</span></button></div>
    </div>
    <div class="modal-foot">${id ? `<button class="btn btn-danger" onclick="deleteSub('${s.id}')">${ic("trash", 13)}<span>Delete</span></button>` : ""}<div class="spacer"></div><button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveSub('${s.id}')">${ic("check", 13)}<span>Save</span></button></div>
  `, "lg");
  (s.items || []).forEach(i => addItemRow(i));
  if (!s.items || !s.items.length) addItemRow();
}

async function saveSub(id) {
  const name = document.getElementById("f_name").value.trim();
  const customerId = document.getElementById("f_cust").value;
  if (!name || !customerId) { UI.toast("Plan & customer required", "error"); return; }
  const items = [];
  document.querySelectorAll("#itemRows > div").forEach(r => {
    const sel = r.querySelector('[data-k="product"]');
    const qty = parseInt(r.querySelector('[data-k="qty"]').value) || 0;
    const price = parseFloat(r.querySelector('[data-k="price"]').value) || 0;
    if (sel.value && qty > 0) { const p = State.products.find(x => x.id === sel.value); items.push({ productId: sel.value, name: p ? p.name : "Item", qty, price }); }
  });
  const body = { name, customerId, frequency: document.getElementById("f_freq").value, nextDelivery: document.getElementById("f_next").value, status: document.getElementById("f_status").value, items };
  try {
    if (id) await API.subscriptions.update(id, body); else await API.subscriptions.create(body);
    await App.refresh(); UI.closeModal(); UI.toast("Subscription saved", "success"); App.render();
  } catch (e) { UI.toast(e.message, "error"); }
}
function deleteSub(id) { UI.confirm("Delete this subscription?", async () => { try { await API.subscriptions.delete(id); await App.refresh(); UI.closeModal(); UI.toast("Deleted", "success"); App.render(); } catch (e) { UI.toast(e.message, "error"); } }, true); }
