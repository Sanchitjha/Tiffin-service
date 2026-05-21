let CUST_PAGE = 1, CUST_SORT = { key: "name", dir: "asc" }, CUST_SIZE = 25;

function pageCustomers() {
  const q = State.search;
  let list = State.customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone || "").includes(q) || (c.email || "").toLowerCase().includes(q) || (c.area || "").toLowerCase().includes(q));
  list = list.map(c => {
    const co = State.orders.filter(o => o.customerId === c.id);
    const ltv = co.filter(o => o.status === "delivered").reduce((s, o) => s + o.total, 0);
    const last = co.sort((a, b) => b.createdAt - a.createdAt)[0];
    return { ...c, _orders: co.length, _ltv: ltv, _last: last ? last.createdAt : 0 };
  });
  list = sortBy(list, CUST_SORT.key, CUST_SORT.dir);
  const totalPages = Math.max(1, Math.ceil(list.length / CUST_SIZE));
  if (CUST_PAGE > totalPages) CUST_PAGE = 1;
  const slice = list.slice((CUST_PAGE - 1) * CUST_SIZE, CUST_PAGE * CUST_SIZE);

  return `
    <div class="page-header">
      <div><div class="page-h1">Customers</div><div class="page-h1-sub">${list.length} of ${State.customers.length} ${q ? `matching "${esc(q)}"` : ""}</div></div>
      <div class="row-tight">
        <button class="btn btn-secondary btn-sm" onclick="exportCustomersCSV()">${ic("download", 13)}<span>Export CSV</span></button>
        <button class="btn btn-primary" onclick="openCustomerForm()">${ic("plus", 13)}<span>Add customer</span></button>
      </div>
    </div>
    <div class="card">
      <div class="table-scroll" style="max-height:calc(100vh - 250px);border:none;border-radius:var(--radius-lg)">
        <table class="table">
          <thead><tr>
            ${thSort("Name","name",CUST_SORT)}
            ${thSort("Phone","phone",CUST_SORT)}
            ${thSort("Area","area",CUST_SORT)}
            <th>Tags</th>
            ${thSort("Orders","_orders",CUST_SORT)}
            ${thSort("Lifetime","_ltv",CUST_SORT)}
            ${thSort("Last order","_last",CUST_SORT)}
            <th style="width:60px"></th>
          </tr></thead>
          <tbody>
            ${slice.length ? slice.map(c => `<tr onclick="openCustomerDetail('${c.id}')">
              <td><div class="row"><div class="avatar ${avClass(c.name)}">${initials(c.name)}</div><div><div style="font-weight:600">${esc(c.name)}</div><div class="muted" style="font-size:11.5px">${esc(c.email || "")}</div></div></div></td>
              <td class="mono" style="font-size:12.5px">${esc(c.phone || "—")}</td>
              <td>${esc(c.area || "—")}</td>
              <td>${(c.tags || []).slice(0, 2).map(t => `<span class="chip" style="margin-right:3px">${esc(t)}</span>`).join("")}${(c.tags || []).length > 2 ? `<span class="chip">+${c.tags.length - 2}</span>` : ""}</td>
              <td class="num">${c._orders}</td>
              <td class="num" style="font-weight:600">${fmtINR(c._ltv)}</td>
              <td class="muted">${c._last ? fmtShort(c._last) : "—"}</td>
              <td><button class="icon-btn" onclick="event.stopPropagation();openCustomerForm('${c.id}')" title="Edit">${ic("edit", 14)}</button></td>
            </tr>`).join("") : `<tr><td colspan="8">${emptyState("users", "No customers", q ? "Try a different search term." : "Add your first customer.", "Add customer", "openCustomerForm()")}</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="between" style="padding:10px 14px;border-top:1px solid var(--c-border)">
        <div class="muted" style="font-size:12px">Page ${CUST_PAGE} of ${totalPages}</div>
        <div class="row-tight">
          <button class="icon-btn" ${CUST_PAGE <= 1 ? "disabled" : ""} onclick="CUST_PAGE=Math.max(1,CUST_PAGE-1);App.render()">${ic("chevronLeft", 14)}</button>
          <button class="icon-btn" ${CUST_PAGE >= totalPages ? "disabled" : ""} onclick="CUST_PAGE=Math.min(${totalPages},CUST_PAGE+1);App.render()">${ic("chevronRight", 14)}</button>
        </div>
      </div>
    </div>`;
}

function openCustomerForm(id) {
  const c = id ? State.customers.find(x => x.id === id) : { id: "", name: "", phone: "", email: "", area: "", address: "", tags: [], notes: "" };
  if (id && !c) { UI.toast("Customer not found"); return; }
  UI.openModal(`
    <div class="modal-head"><div><div class="modal-title">${id ? "Edit customer" : "Add customer"}</div><div class="modal-sub">${id ? "Update customer details" : "Create a new customer profile"}</div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="field"><label class="lbl">Full name *</label><input id="f_name" class="input" value="${esc(c.name)}" placeholder="Aarav Sharma"/></div>
      <div class="field-row">
        <div class="field"><label class="lbl">Phone</label><input id="f_phone" class="input" value="${esc(c.phone || "")}" placeholder="+91 …"/></div>
        <div class="field"><label class="lbl">Email</label><input id="f_email" class="input" value="${esc(c.email || "")}" placeholder="name@example.com"/></div>
      </div>
      <div class="field-row">
        <div class="field"><label class="lbl">Area / Locality</label><input id="f_area" class="input" value="${esc(c.area || "")}" placeholder="Adajan"/></div>
        <div class="field"><label class="lbl">Tags (comma-sep)</label><input id="f_tags" class="input" value="${esc((c.tags || []).join(", "))}" placeholder="vip, vegan, office"/></div>
      </div>
      <div class="field"><label class="lbl">Address</label><textarea id="f_address" class="textarea" rows="2">${esc(c.address || "")}</textarea></div>
      <div class="field-row">
        <div class="field"><label class="lbl">Dietary type</label><select id="f_diet" class="select"><option value="">— Not set —</option>${["Veg","Non-Veg","Jain","Diet"].map(d => `<option value="${d}" ${(c.preferences || {}).dietaryType === d ? "selected" : ""}>${d}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl">Spice level</label><select id="f_spice" class="select"><option value="">— Not set —</option>${["Mild","Medium","Spicy"].map(s => `<option value="${s}" ${(c.preferences || {}).spiceLevel === s ? "selected" : ""}>${s}</option>`).join("")}</select></div>
      </div>
      <div class="field"><label class="lbl">Notes</label><textarea id="f_notes" class="textarea" rows="2">${esc(c.notes || "")}</textarea></div>
    </div>
    <div class="modal-foot">
      ${id ? `<button class="btn btn-danger" onclick="deleteCustomer('${c.id}')">${ic("trash", 13)}<span>Delete</span></button>` : ""}
      <div class="spacer"></div>
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCustomer('${c.id}')">${ic("check", 13)}<span>Save</span></button>
    </div>
  `);
  setTimeout(() => document.getElementById("f_name").focus(), 50);
}

async function saveCustomer(id) {
  const name = document.getElementById("f_name").value.trim();
  if (!name) { UI.toast("Name is required", "error"); return; }
  const dietVal = document.getElementById("f_diet").value;
  const spiceVal = document.getElementById("f_spice").value;
  const body = {
    name,
    phone: document.getElementById("f_phone").value.trim(),
    email: document.getElementById("f_email").value.trim(),
    area: document.getElementById("f_area").value.trim(),
    tags: document.getElementById("f_tags").value.split(",").map(s => s.trim()).filter(Boolean),
    address: document.getElementById("f_address").value.trim(),
    notes: document.getElementById("f_notes").value.trim(),
    preferences: { ...(dietVal ? { dietaryType: dietVal } : {}), ...(spiceVal ? { spiceLevel: spiceVal } : {}) },
  };
  try {
    if (id) await API.customers.update(id, body);
    else await API.customers.create(body);
    await App.refresh();
    UI.closeModal(); UI.toast(id ? "Customer updated" : "Customer added", "success"); App.render(); renderNav();
  } catch (e) { UI.toast(e.message, "error"); }
}

function deleteCustomer(id) {
  UI.confirm("Delete this customer? Their order history will be preserved.", async () => {
    try { await API.customers.delete(id); await App.refresh(); UI.closeModal(); UI.toast("Deleted", "success"); App.render(); renderNav(); }
    catch (e) { UI.toast(e.message, "error"); }
  }, true);
}

async function openCustomerDetail(id) {
  let c;
  try { c = await API.customers.get(id); } catch (e) { UI.toast(e.message, "error"); return; }
  const avg = c.orders.filter(o => o.status === "delivered").length ? Math.round(c.ltv / c.orders.filter(o => o.status === "delivered").length) : 0;
  UI.openModal(`
    <div class="modal-head"><div class="row"><div class="avatar ${avClass(c.name)}" style="width:44px;height:44px;font-size:14px">${initials(c.name)}</div><div><div class="modal-title">${esc(c.name)}</div><div class="modal-sub">${esc(c.phone || "—")} ${c.email ? "• " + esc(c.email) : ""}</div></div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div class="kpi"><div class="kpi-label">Lifetime value</div><div class="kpi-value">${fmtINR(c.ltv)}</div></div>
        <div class="kpi"><div class="kpi-label">Total orders</div><div class="kpi-value">${c.orders.length}</div></div>
        <div class="kpi"><div class="kpi-label">Avg order</div><div class="kpi-value">${fmtINR(avg)}</div></div>
      </div>
      ${c.address || c.area || c.notes || (c.tags || []).length ? `<div class="card card-pad" style="margin-bottom:14px">
        ${c.area ? `<div class="row-tight" style="margin-bottom:6px"><span style="color:var(--c-muted)">${ic("mappin", 14)}</span><span style="font-size:13px">${esc(c.area)}${c.address ? ", " + esc(c.address) : ""}</span></div>` : ""}
        ${(c.tags || []).length ? `<div style="margin-bottom:6px">${(c.tags || []).map(t => `<span class="chip" style="margin-right:4px">${esc(t)}</span>`).join("")}</div>` : ""}
        ${(c.preferences && (c.preferences.dietaryType || c.preferences.spiceLevel)) ? `<div style="margin-bottom:6px;display:flex;gap:6px;flex-wrap:wrap">${c.preferences.dietaryType ? `<span style="background:var(--c-success-tint,#e8f5e9);color:#2e7d32;border:1px solid #a5d6a7;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:600">${esc(c.preferences.dietaryType)}</span>` : ""}${c.preferences.spiceLevel ? `<span style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:99px;padding:2px 10px;font-size:12px;font-weight:600">${esc(c.preferences.spiceLevel)} spice</span>` : ""}</div>` : ""}
        ${c.notes ? `<div style="font-size:13px;color:var(--c-ink-2)"><b>Notes:</b> ${esc(c.notes)}</div>` : ""}
      </div>` : ""}
      <div class="row-tight" style="margin-bottom:14px">
        <button class="btn btn-secondary btn-sm" onclick="openCustomerForm('${c.id}')">${ic("edit", 12)}<span>Edit</span></button>
        <button class="btn btn-primary btn-sm" onclick="openOrderForm(null,'${c.id}')">${ic("plus", 12)}<span>New order</span></button>
        <button class="btn btn-secondary btn-sm" onclick="openSubForm(null,'${c.id}')">${ic("repeat", 12)}<span>New subscription</span></button>
        ${c.phone ? `<a class="btn btn-secondary btn-sm" target="_blank" href="https://wa.me/${phoneClean(c.phone)}">${ic("message", 12)}<span>WhatsApp</span></a>` : ""}
      </div>
      <div class="card-title" style="margin-bottom:8px">Order history</div>
      <div class="table-scroll" style="max-height:280px;margin-bottom:14px">
        <table class="table">
          <thead><tr><th>Date</th><th>Items</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>${c.orders.length ? c.orders.slice(0, 15).map(o => `<tr onclick="UI.closeModal();setTimeout(()=>openOrderDetail('${o.id}'),50)"><td>${fmtShort(o.createdAt)}</td><td style="font-size:12px">${(o.items || []).map(i => esc(i.qty + "× " + i.name)).join(", ")}</td><td style="font-weight:600" class="num">${fmtINR(o.total)}</td><td>${orderBadge(o.status)}</td></tr>`).join("") : `<tr><td colspan="4" class="muted" style="padding:18px;text-align:center">No orders yet</td></tr>`}</tbody>
        </table>
      </div>
      ${c.subscriptions.length ? `<div class="card-title" style="margin-bottom:8px">Subscriptions</div>
      <div class="table-scroll"><table class="table"><thead><tr><th>Plan</th><th>Frequency</th><th>Next delivery</th><th>Status</th></tr></thead><tbody>${c.subscriptions.map(s => `<tr><td style="font-weight:600">${esc(s.name)}</td><td>${esc(s.frequency)}</td><td>${fmtDate(s.nextDelivery)}</td><td>${s.status === "active" ? '<span class="badge badge-success"><span class="dot"></span>Active</span>' : s.status === "paused" ? '<span class="badge badge-accent"><span class="dot"></span>Paused</span>' : '<span class="badge badge-danger"><span class="dot"></span>Cancelled</span>'}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </div>
  `, "lg");
}

function exportCustomersCSV() {
  const headers = ["Name","Phone","Email","Area","Address","Tags","Notes","Orders","LifetimeValue","CreatedAt"];
  const rows = State.customers.map(c => {
    const co = State.orders.filter(o => o.customerId === c.id);
    const ltv = co.filter(o => o.status === "delivered").reduce((s, o) => s + o.total, 0);
    return [c.name, c.phone || "", c.email || "", c.area || "", c.address || "", (c.tags || []).join("; "), c.notes || "", co.length, ltv, new Date(c.createdAt).toISOString()].map(csvEscape).join(",");
  });
  downloadFile(`customers-${todayISO()}.csv`, [headers.join(","), ...rows].join("\n"), "text/csv");
  UI.toast("Customers exported", "success");
}
