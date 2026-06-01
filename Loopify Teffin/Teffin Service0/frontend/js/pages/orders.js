let ORDER_FILTER = "all", ORDER_SORT = { key: "createdAt", dir: "desc" };

function pageOrders() {
  const q = State.search;
  let list = State.orders.slice();
  if (ORDER_FILTER !== "all") list = list.filter(o => o.status === ORDER_FILTER);
  if (q) list = list.filter(o => { const cu = State.customers.find(x => x.id === o.customerId); return (cu && cu.name.toLowerCase().includes(q)) || o.id.toLowerCase().includes(q); });
  list = sortBy(list, ORDER_SORT.key, ORDER_SORT.dir);
  const counts = { all: State.orders.length };
  ORDER_STAGES.forEach(s => counts[s] = State.orders.filter(o => o.status === s).length);
  return `
    <div class="page-header">
      <div><div class="page-h1">Orders</div><div class="page-h1-sub">${list.length} of ${State.orders.length} ${q ? `matching "${esc(q)}"` : ""}</div></div>
      <div class="row-tight"><button class="btn btn-secondary btn-sm" onclick="exportOrdersCSV()">${ic("download", 13)}<span>Export CSV</span></button><button class="btn btn-primary" onclick="openOrderForm()">${ic("plus", 13)}<span>New order</span></button></div>
    </div>
    <div class="tabs" style="margin-bottom:14px;flex-wrap:wrap;width:fit-content;max-width:100%">
      <div class="tab ${ORDER_FILTER === "all" ? "active" : ""}" onclick="ORDER_FILTER='all';App.render()">All <span class="muted" style="margin-left:4px">${counts.all}</span></div>
      ${ORDER_STAGES.map(s => `<div class="tab ${ORDER_FILTER === s ? "active" : ""}" onclick="ORDER_FILTER='${s}';App.render()">${esc(ORDER_LABEL[s])} <span class="muted" style="margin-left:4px">${counts[s]}</span></div>`).join("")}
    </div>
    <div class="card">
      <div class="table-scroll" style="max-height:calc(100vh - 280px);border:none;border-radius:var(--radius-lg)">
        <table class="table">
          <thead><tr><th>Order</th><th onclick="sortToggle('ord','createdAt')" class="${ORDER_SORT.key === "createdAt" ? "sorted" : ""}">Date <span class="sort-ico">${ic("chevronDown", 10)}</span></th><th>Customer</th><th>Items</th><th onclick="sortToggle('ord','total')" class="${ORDER_SORT.key === "total" ? "sorted" : ""}">Total <span class="sort-ico">${ic("chevronDown", 10)}</span></th><th>Status</th><th>Partner</th><th style="width:60px"></th></tr></thead>
          <tbody>
            ${list.length ? list.map(o => { const cu = State.customers.find(c => c.id === o.customerId); const p = State.partners.find(x => x.id === o.partnerId); return `<tr onclick="openOrderDetail('${o.id}')">
              <td class="mono" style="font-weight:600;font-size:12.5px">#${o.id.slice(-6).toUpperCase()}</td>
              <td class="muted">${fmtShort(o.createdAt)}</td>
              <td><div class="row"><div class="avatar ${avClass(cu ? cu.name : "")}">${initials(cu ? cu.name : "?")}</div><div><div style="font-weight:600">${esc(cu ? cu.name : "—")}</div><div class="muted mono" style="font-size:11.5px">${esc(cu ? cu.phone || "" : "")}</div></div></div></td>
              <td style="font-size:12px;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc((o.items || []).map(i => i.qty + "× " + i.name).join(", "))}</td>
              <td style="font-weight:700" class="num">${fmtINR(o.total)}</td>
              <td>${orderBadge(o.status)}</td>
              <td>${p ? esc(p.name) : '<span class="muted">—</span>'}</td>
              <td><button class="icon-btn" onclick="event.stopPropagation();openOrderForm('${o.id}')" title="Edit">${ic("edit", 14)}</button></td>
            </tr>`; }).join("") : `<tr><td colspan="8">${emptyState("package", "No orders", q || ORDER_FILTER !== "all" ? "Try clearing filters." : "Record your first tiffin order.", "New order", "openOrderForm()")}</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>`;
}

function openOrderForm(orderId, preCustomerId) {
  const o = orderId ? State.orders.find(x => x.id === orderId) : { id: "", customerId: preCustomerId || "", items: [], status: "pending", partnerId: "", deliveryAddress: "", deliveryFee: 0, notes: "" };
  if (orderId && !o) { UI.toast("Order not found"); return; }
  UI.openModal(`
    <div class="modal-head"><div><div class="modal-title">${orderId ? "Edit order" : "New order"}</div><div class="modal-sub">${orderId ? "#" + o.id.slice(-6).toUpperCase() : "Add line items, customer, and delivery info"}</div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field"><label class="lbl">Customer *</label><select id="f_cust" class="select" onchange="onOrderCustChange()"><option value="">— Select customer —</option>${State.customers.map(c => `<option value="${c.id}" ${c.id === o.customerId ? "selected" : ""}>${esc(c.name)} ${c.phone ? "(" + esc(c.phone) + ")" : ""}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl">Delivery partner</label><select id="f_partner" class="select"><option value="">— Unassigned —</option>${State.partners.filter(p => p.active).map(p => `<option value="${p.id}" ${p.id === o.partnerId ? "selected" : ""}>${esc(p.name)} • ${esc(p.area || "")}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label class="lbl">Delivery address</label><textarea id="f_addr" class="textarea" rows="2">${esc(o.deliveryAddress || "")}</textarea></div>
      <div class="field"><label class="lbl">Line items</label><div id="itemRows" style="display:flex;flex-direction:column;gap:6px"></div><button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="addItemRow()">${ic("plus", 12)}<span>Add item</span></button></div>
      <div class="field-row-3">
        <div class="field"><label class="lbl">Status</label><select id="f_status" class="select">${ORDER_STAGES.map(s => `<option value="${s}" ${s === o.status ? "selected" : ""}>${ORDER_LABEL[s]}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl">Delivery fee (₹)</label><input id="f_fee" class="input" type="number" min="0" value="${o.deliveryFee || 0}"/></div>
        <div class="field"><label class="lbl">Total</label><div class="input" style="background:var(--c-surface-2);font-weight:700" id="f_total">—</div></div>
      </div>
      <div class="field"><label class="lbl">Customizations</label><div id="f_custs" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px 12px;padding:10px;background:var(--c-surface-2);border-radius:var(--radius-md);border:1px solid var(--c-border)">${["No Onion/Garlic","Mild Spice","Extra Spicy","Extra Roti (+2)","Less Salt","No Pickle","Extra Dal","No Sugar/Sweets","Less Oil"].map(c => `<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13px"><input type="checkbox" value="${esc(c)}" ${(o.customizations || []).includes(c) ? "checked" : ""} style="accent-color:var(--c-brand)"/>${esc(c)}</label>`).join("")}</div></div>
      <div class="field"><label class="lbl">Notes</label><textarea id="f_notes" class="textarea" rows="2">${esc(o.notes || "")}</textarea></div>
    </div>
    <div class="modal-foot">${orderId ? `<button class="btn btn-danger" onclick="deleteOrder('${o.id}')">${ic("trash", 13)}<span>Delete</span></button>` : ""}<div class="spacer"></div><button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveOrder('${o.id}')">${ic("check", 13)}<span>Save order</span></button></div>
  `, "lg");
  (o.items || []).forEach(i => addItemRow(i));
  if (!o.items || !o.items.length) addItemRow();
  onOrderCustChange(); recalcOrderTotal();
}

function onOrderCustChange() {
  const sel = document.getElementById("f_cust"); if (!sel) return;
  const cu = State.customers.find(c => c.id === sel.value);
  const addr = document.getElementById("f_addr");
  if (cu && addr && !addr.value) addr.value = cu.address || "";
}
function addItemRow(prefill) {
  const root = document.getElementById("itemRows");
  const div = document.createElement("div");
  div.style.cssText = "display:grid;grid-template-columns:1fr 80px 110px 38px;gap:6px;align-items:center";
  div.innerHTML = `<select class="select" data-k="product" onchange="onItemProductChange(this);recalcOrderTotal()"><option value="">— Pick tiffin —</option>${State.products.map(p => `<option value="${p.id}" data-price="${p.price}" ${prefill && prefill.productId === p.id ? "selected" : ""}>${esc(p.name)} — ${fmtINR(p.price)}</option>`).join("")}</select><input class="input" data-k="qty" type="number" min="1" value="${prefill ? prefill.qty : 1}" placeholder="Qty" onchange="recalcOrderTotal()"/><input class="input" data-k="price" type="number" min="0" value="${prefill ? prefill.price : ""}" placeholder="Price" onchange="recalcOrderTotal()"/><button class="icon-btn" onclick="this.parentElement.remove();recalcOrderTotal()">${ic("trash", 14)}</button>`;
  root.appendChild(div);
}
function onItemProductChange(sel) { const opt = sel.options[sel.selectedIndex]; const row = sel.parentElement; const priceIn = row.querySelector('[data-k="price"]'); if (opt && opt.dataset.price) priceIn.value = opt.dataset.price; }
function recalcOrderTotal() {
  const rows = document.querySelectorAll("#itemRows > div"); let sub = 0;
  rows.forEach(r => { const q = parseFloat(r.querySelector('[data-k="qty"]').value) || 0; const p = parseFloat(r.querySelector('[data-k="price"]').value) || 0; sub += q * p; });
  const feeEl = document.getElementById("f_fee"); const fee = feeEl ? (parseFloat(feeEl.value) || 0) : 0;
  const tot = document.getElementById("f_total"); if (tot) tot.textContent = fmtINR(sub + fee);
}
document.addEventListener("input", e => { if (e.target && e.target.id === "f_fee") recalcOrderTotal(); });

async function saveOrder(id) {
  const customerId = document.getElementById("f_cust").value;
  if (!customerId) { UI.toast("Pick a customer", "error"); return; }
  const items = [];
  document.querySelectorAll("#itemRows > div").forEach(r => {
    const sel = r.querySelector('[data-k="product"]');
    const qty = parseInt(r.querySelector('[data-k="qty"]').value) || 0;
    const price = parseFloat(r.querySelector('[data-k="price"]').value) || 0;
    if (sel.value && qty > 0) { const p = State.products.find(x => x.id === sel.value); items.push({ productId: sel.value, name: p ? p.name : "Item", qty, price }); }
  });
  if (!items.length) { UI.toast("Add at least one item", "error"); return; }
  const customizations = Array.from(document.querySelectorAll("#f_custs input[type=checkbox]:checked")).map(cb => cb.value);
  const body = {
    customerId,
    partnerId: document.getElementById("f_partner").value,
    deliveryAddress: document.getElementById("f_addr").value.trim(),
    items,
    customizations,
    status: document.getElementById("f_status").value,
    notes: document.getElementById("f_notes").value.trim(),
    deliveryFee: parseFloat(document.getElementById("f_fee").value) || 0,
  };
  try {
    if (id) await API.orders.update(id, body); else await API.orders.create(body);
    await App.refresh();
    UI.closeModal(); UI.toast(id ? "Order updated" : "Order created", "success"); App.render(); renderNav();
  } catch (e) { UI.toast(e.message, "error"); }
}

function deleteOrder(id) {
  UI.confirm("Delete this order? This cannot be undone.", async () => {
    try { await API.orders.delete(id); await App.refresh(); UI.closeModal(); UI.toast("Order deleted", "success"); App.render(); }
    catch (e) { UI.toast(e.message, "error"); }
  }, true);
}

async function openOrderDetail(id) {
  const o = State.orders.find(x => x.id === id); if (!o) { UI.toast("Not found"); return; }
  const cu = State.customers.find(c => c.id === o.customerId);
  const p = State.partners.find(x => x.id === o.partnerId);
  const stageIdx = ORDER_STAGES.indexOf(o.status);
  const isCancelled = o.status === "cancelled";
  const timeline = ORDER_STAGES.filter(s => s !== "cancelled").map((s, i) => {
    const reached = !isCancelled && i <= stageIdx;
    const active = !isCancelled && i === stageIdx && o.status !== "delivered";
    const ev = (o.events || []).find(e => e.status === s);
    return `<div class="tl-step"><div class="tl-dot ${reached ? "done" : ""} ${active ? "active" : ""}"></div><div class="flex-1"><div class="tl-label ${reached ? "" : "muted"}">${ORDER_LABEL[s]}</div><div class="tl-time">${ev ? fmtTime(ev.at) : "—"}</div></div></div>`;
  }).join("");
  UI.openModal(`
    <div class="modal-head">
      <div><div class="modal-title row-tight">Order <span class="mono">#${o.id.slice(-6).toUpperCase()}</span></div><div class="modal-sub">${fmtTime(o.createdAt)}</div></div>
      <div class="row-tight">${orderBadge(o.status)}<button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    </div>
    <div class="modal-body">
      <div class="detail-grid">
        <div>
          <div class="card card-pad" style="margin-bottom:12px"><div class="card-sub" style="margin-bottom:6px">CUSTOMER</div><div class="row" style="margin-bottom:8px"><div class="avatar ${avClass(cu ? cu.name : "")}" style="width:40px;height:40px;font-size:13px">${initials(cu ? cu.name : "?")}</div><div><div style="font-weight:700;font-size:14px">${esc(cu ? cu.name : "—")}</div><div class="muted mono" style="font-size:12px">${esc(cu ? cu.phone || "" : "")}</div></div></div>${o.deliveryAddress || (cu && cu.address) ? `<div class="muted" style="font-size:12.5px">${ic("mappin", 12)} ${esc(o.deliveryAddress || (cu && cu.address) || "")}</div>` : ""}</div>
          <div class="card card-pad" style="margin-bottom:12px"><div class="card-sub" style="margin-bottom:6px">DELIVERY PARTNER</div>${p ? `<div class="row"><div class="avatar ${avClass(p.name)}" style="width:36px;height:36px">${initials(p.name)}</div><div><div style="font-weight:600;font-size:13px">${esc(p.name)}</div><div class="muted mono" style="font-size:12px">${esc(p.phone || "")}</div></div></div>` : '<div class="muted">Unassigned</div>'}<select class="select" style="margin-top:8px" onchange="assignPartner('${o.id}',this.value)"><option value="">— Reassign —</option>${State.partners.filter(p => p.active).map(p2 => `<option value="${p2.id}" ${p2.id === o.partnerId ? "selected" : ""}>${esc(p2.name)} • ${esc(p2.area || "")}</option>`).join("")}</select></div>
          <div class="card"><div class="card-head"><div class="card-title">Items</div></div><div class="card-pad">${(o.items || []).map(i => `<div class="between" style="padding:5px 0"><span style="font-size:13px">${i.qty}× ${esc(i.name)}</span><span class="num" style="font-weight:600">${fmtINR(i.qty * i.price)}</span></div>`).join("")}<div class="divider"></div><div class="between" style="font-size:13px"><span class="muted">Subtotal</span><span class="num">${fmtINR(o.subtotal)}</span></div><div class="between" style="font-size:13px"><span class="muted">Delivery</span><span class="num">${fmtINR(o.deliveryFee || 0)}</span></div><div class="between" style="font-size:15px;font-weight:700;margin-top:6px"><span>Total</span><span class="num" style="color:var(--c-brand)">${fmtINR(o.total)}</span></div></div></div>
          ${(o.customizations || []).length ? `<div class="card card-pad" style="margin-top:12px"><div class="card-sub" style="margin-bottom:6px">CUSTOMIZATIONS</div><div style="display:flex;flex-wrap:wrap;gap:6px">${(o.customizations || []).map(c => `<span style="background:var(--c-accent-tint);color:var(--c-accent);border:1px solid var(--c-accent);border-radius:99px;padding:2px 10px;font-size:12px;font-weight:500">${esc(c)}</span>`).join("")}</div></div>` : ""}
          ${o.notes ? `<div class="card card-pad" style="margin-top:12px;background:var(--c-accent-tint);border-color:var(--c-accent)"><div class="card-sub" style="margin-bottom:4px">NOTES</div><div style="font-size:13px">${esc(o.notes)}</div></div>` : ""}
        </div>
        <div>
          <div class="card"><div class="card-head"><div class="card-title">Tracking</div></div><div class="card-pad timeline">${timeline}</div></div>
          <div class="card" style="margin-top:12px"><div class="card-head"><div class="card-title">Update status</div></div><div class="card-pad" style="display:flex;flex-wrap:wrap;gap:6px">${ORDER_STAGES.map(s => `<button class="btn ${s === o.status ? "btn-primary" : "btn-secondary"} btn-sm" onclick="advanceOrder('${o.id}','${s}')">${ORDER_LABEL[s]}</button>`).join("")}</div></div>
          <div class="row-tight" style="margin-top:12px;flex-wrap:wrap"><button class="btn btn-secondary btn-sm" onclick="openOrderForm('${o.id}')">${ic("edit", 12)}<span>Edit order</span></button><button class="btn btn-secondary btn-sm" onclick="printInvoice('${o.id}')">${ic("printer", 12)}<span>Print invoice</span></button>${cu && cu.phone ? `<a class="btn btn-secondary btn-sm" target="_blank" href="https://wa.me/${phoneClean(cu.phone)}?text=${encodeURIComponent("Hi " + cu.name + "! Your DabbaBox tiffin order #" + o.id.slice(-6).toUpperCase() + " is " + ORDER_LABEL[o.status] + ". Total: " + fmtINR(o.total))}">${ic("message", 12)}<span>WhatsApp</span></a>` : ""}</div>
        </div>
      </div>
    </div>`, "xl");
}

async function assignPartner(orderId, partnerId) {
  try { await API.orders.patchPartner(orderId, partnerId); await App.refresh(); UI.toast("Partner assigned", "success"); openOrderDetail(orderId); }
  catch (e) { UI.toast(e.message, "error"); }
}
async function advanceOrder(orderId, newStatus) {
  const o = State.orders.find(x => x.id === orderId); if (!o || o.status === newStatus) return;
  try { await API.orders.patchStatus(orderId, newStatus); await App.refresh(); openOrderDetail(orderId); UI.toast("Status updated", "success"); }
  catch (e) { UI.toast(e.message, "error"); }
}

function printInvoice(orderId) {
  const o = State.orders.find(x => x.id === orderId); if (!o) return;
  const cu = State.customers.find(c => c.id === o.customerId); const b = State.business;
  const win = window.open("", "_blank", "width=720,height=900");
  const html = `<!doctype html><html><head><title>Invoice #${o.id.slice(-6).toUpperCase()}</title><style>body{font-family:Inter,sans-serif;padding:36px;color:#111;max-width:780px;margin:auto;font-size:13px;line-height:1.5}h1{margin:0;font-size:28px;letter-spacing:-.02em;font-family:Fraunces,Georgia,serif}.bar{height:6px;background:linear-gradient(90deg,#4a7c59,#f9a620);margin:16px 0 28px;border-radius:3px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #e7e5e4}th{background:#f5f3ed;font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:#666}.totals{margin-left:auto;width:280px}.totals .row{display:flex;justify-content:space-between;padding:5px 0}.totals .total{font-weight:700;font-size:18px;border-top:2px solid #111;padding-top:8px;margin-top:6px}.head{display:flex;justify-content:space-between;align-items:flex-start}.muted{color:#666;font-size:12px}@media print{body{padding:0}}</style></head><body><div class="head"><div><h1>${esc(b.name)}</h1><div class="muted">${esc(b.address)}</div><div class="muted">${esc(b.phone)} • ${esc(b.email)}</div></div><div style="text-align:right"><div style="font-size:22px;font-weight:700;font-family:Fraunces,Georgia,serif">INVOICE</div><div style="font-family:monospace;font-size:14px">#${o.id.slice(-6).toUpperCase()}</div><div class="muted">${fmtDate(o.createdAt)}</div></div></div><div class="bar"></div><div style="display:flex;justify-content:space-between;gap:30px"><div><div class="muted" style="font-weight:600">BILL TO</div><div style="font-weight:600;font-size:15px;margin-top:4px">${esc(cu ? cu.name : "—")}</div><div class="muted">${esc(cu ? cu.phone || "" : "")}</div><div class="muted">${esc(o.deliveryAddress || (cu && cu.address) || "")}</div></div><div style="text-align:right"><div class="muted" style="font-weight:600">STATUS</div><div style="font-weight:600;font-size:15px;margin-top:4px;color:#4a7c59">${ORDER_LABEL[o.status]}</div></div></div><table><thead><tr><th>Item</th><th style="text-align:right">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead><tbody>${(o.items || []).map(i => `<tr><td>${esc(i.name)}</td><td style="text-align:right">${i.qty}</td><td style="text-align:right">${fmtINR(i.price)}</td><td style="text-align:right">${fmtINR(i.qty * i.price)}</td></tr>`).join("")}</tbody></table><div class="totals"><div class="row"><span class="muted">Subtotal</span><span>${fmtINR(o.subtotal)}</span></div><div class="row"><span class="muted">Delivery</span><span>${fmtINR(o.deliveryFee || 0)}</span></div><div class="row total"><span>Total</span><span>${fmtINR(o.total)}</span></div></div>${o.notes ? `<div style="margin-top:30px;padding:14px 16px;background:#fde9c1;border-radius:8px;font-size:12.5px"><b>Notes:</b> ${esc(o.notes)}</div>` : ""}<div style="margin-top:40px;text-align:center;color:#999;font-size:11px">Thank you for choosing ${esc(b.name)} 🍱</div></body></html>`;
  win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300);
}
function exportOrdersCSV() {
  const headers = ["OrderID","Date","CustomerName","Phone","Items","Subtotal","DeliveryFee","Total","Status","Partner","Address"];
  const rows = State.orders.map(o => { const cu = State.customers.find(c => c.id === o.customerId); const p = State.partners.find(x => x.id === o.partnerId); return [o.id, new Date(o.createdAt).toISOString(), (cu && cu.name) || "", (cu && cu.phone) || "", (o.items || []).map(i => `${i.qty}× ${i.name}`).join("; "), o.subtotal, o.deliveryFee || 0, o.total, ORDER_LABEL[o.status], (p && p.name) || "", o.deliveryAddress || ""].map(csvEscape).join(","); });
  downloadFile(`orders-${todayISO()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
  UI.toast("Orders exported", "success");
}
