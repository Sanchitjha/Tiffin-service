function pagePartners() {
  const list = State.partners;
  return `
    <div class="page-header"><div><div class="page-h1">Delivery partners</div><div class="page-h1-sub">${list.filter(p => p.active).length} active • ${list.length} total</div></div><button class="btn btn-primary" onclick="openPartnerForm()">${ic("plus", 13)}<span>Add partner</span></button></div>
    <div class="prod-grid">
      ${list.length ? list.map(p => { const assigned = State.orders.filter(o => o.partnerId === p.id); const delivered = assigned.filter(o => o.status === "delivered").length; const inProgress = assigned.filter(o => ["confirmed","preparing","out_for_delivery"].includes(o.status)).length; return `<div class="card card-pad" style="cursor:pointer" onclick="openPartnerDetail('${p.id}')">
        <div class="row" style="margin-bottom:10px">
          <div class="avatar ${avClass(p.name)}" style="width:42px;height:42px;font-size:14px">${initials(p.name)}</div>
          <div class="flex-1"><div style="font-weight:700;font-size:14px">${esc(p.name)}</div><div class="muted mono" style="font-size:11.5px">${esc(p.phone || "")}</div><div class="muted" style="font-size:11.5px">${esc(p.area || "")} ${p.vehicle ? "• " + esc(p.vehicle) : ""}</div></div>
          <span class="badge ${p.active ? "badge-success" : "badge-neutral"}"><span class="dot"></span>${p.active ? "Active" : "Off"}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center">
          <div style="background:var(--c-surface-2);border-radius:8px;padding:8px"><div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Active</div><div style="font-weight:700;font-size:18px;color:var(--c-accent)">${inProgress}</div></div>
          <div style="background:var(--c-surface-2);border-radius:8px;padding:8px"><div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Delivered</div><div style="font-weight:700;font-size:18px;color:var(--c-success)">${delivered}</div></div>
          <div style="background:var(--c-surface-2);border-radius:8px;padding:8px"><div class="muted" style="font-size:11px;text-transform:uppercase;letter-spacing:.04em">Total</div><div style="font-weight:700;font-size:18px">${assigned.length}</div></div>
        </div>
      </div>`; }).join("") : emptyState("truck", "No delivery partners", "Add riders so you can assign orders to them.", "Add partner", "openPartnerForm()")}
    </div>`;
}

function openPartnerForm(id) {
  const p = id ? State.partners.find(x => x.id === id) : { id: "", name: "", phone: "", area: "", vehicle: "Bike", active: true };
  if (id && !p) { UI.toast("Not found"); return; }
  UI.openModal(`
    <div class="modal-head"><div><div class="modal-title">${id ? "Edit partner" : "New delivery partner"}</div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="field"><label class="lbl">Name *</label><input id="f_name" class="input" value="${esc(p.name)}"/></div>
      <div class="field-row">
        <div class="field"><label class="lbl">Phone</label><input id="f_phone" class="input" value="${esc(p.phone || "")}"/></div>
        <div class="field"><label class="lbl">Area</label><input id="f_area" class="input" value="${esc(p.area || "")}"/></div>
      </div>
      <div class="field-row">
        <div class="field"><label class="lbl">Vehicle</label><select id="f_vehicle" class="select">${["Bike","Scooter","Cycle","Car","Walk"].map(v => `<option ${v === p.vehicle ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl">Status</label><div class="row" style="height:36px;align-items:center;gap:10px"><label class="switch"><input type="checkbox" id="f_active" ${p.active ? "checked" : ""}/><span class="slider"></span></label><span id="actLabel" style="font-size:13px;font-weight:600">${p.active ? "Active" : "Inactive"}</span></div></div>
      </div>
    </div>
    <div class="modal-foot">${id ? `<button class="btn btn-danger" onclick="deletePartner('${p.id}')">${ic("trash", 13)}<span>Delete</span></button>` : ""}<div class="spacer"></div><button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button><button class="btn btn-primary" onclick="savePartner('${p.id}')">${ic("check", 13)}<span>Save</span></button></div>
  `);
  const cb = document.getElementById("f_active");
  if (cb) cb.addEventListener("change", e => { document.getElementById("actLabel").textContent = e.target.checked ? "Active" : "Inactive"; });
}

async function savePartner(id) {
  const name = document.getElementById("f_name").value.trim();
  if (!name) { UI.toast("Name required", "error"); return; }
  const body = { name, phone: document.getElementById("f_phone").value.trim(), area: document.getElementById("f_area").value.trim(), vehicle: document.getElementById("f_vehicle").value, active: document.getElementById("f_active").checked };
  try { if (id) await API.partners.update(id, body); else await API.partners.create(body); await App.refresh(); UI.closeModal(); UI.toast("Partner saved", "success"); App.render(); }
  catch (e) { UI.toast(e.message, "error"); }
}
function deletePartner(id) { UI.confirm("Delete this partner?", async () => { try { await API.partners.delete(id); await App.refresh(); UI.closeModal(); UI.toast("Deleted", "success"); App.render(); } catch (e) { UI.toast(e.message, "error"); } }, true); }

function openPartnerDetail(id) {
  const p = State.partners.find(x => x.id === id); if (!p) return;
  const orders = State.orders.filter(o => o.partnerId === id).sort((a, b) => b.createdAt - a.createdAt);
  UI.openModal(`
    <div class="modal-head"><div class="row"><div class="avatar ${avClass(p.name)}" style="width:42px;height:42px;font-size:14px">${initials(p.name)}</div><div><div class="modal-title">${esc(p.name)}</div><div class="modal-sub">${esc(p.area || "")} • ${esc(p.vehicle || "")} • ${esc(p.phone || "")}</div></div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="row-tight" style="margin-bottom:14px"><button class="btn btn-secondary btn-sm" onclick="openPartnerForm('${p.id}')">${ic("edit", 12)}<span>Edit</span></button>${p.phone ? `<a class="btn btn-secondary btn-sm" target="_blank" href="https://wa.me/${phoneClean(p.phone)}">${ic("message", 12)}<span>WhatsApp</span></a>` : ""}</div>
      <div class="card-title" style="margin-bottom:8px">Assigned orders</div>
      <div class="table-scroll" style="max-height:400px"><table class="table"><thead><tr><th>Date</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead><tbody>${orders.length ? orders.map(o => { const cu = State.customers.find(c => c.id === o.customerId); return `<tr onclick="UI.closeModal();setTimeout(()=>openOrderDetail('${o.id}'),50)"><td>${fmtShort(o.createdAt)}</td><td>${esc(cu ? cu.name : "—")}</td><td class="num" style="font-weight:600">${fmtINR(o.total)}</td><td>${orderBadge(o.status)}</td></tr>`; }).join("") : `<tr><td colspan="4" class="muted" style="padding:18px;text-align:center">No orders yet</td></tr>`}</tbody></table></div>
    </div>`, "lg");
}
