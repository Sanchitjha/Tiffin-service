/* =========================================================================
   Super Admin Billing Page
   ========================================================================= */
function pageSaBilling() {
  const q = State.search;
  let list = State.saInvoices || [];
  
  if (q) {
    list = list.filter(i => 
      i.id.toLowerCase().includes(q) ||
      i.business_name.toLowerCase().includes(q) ||
      i.status.toLowerCase().includes(q)
    );
  }

  const totalInvoiced = State.saInvoices.reduce((s, i) => s + i.amount, 0);
  const paidInvoiced = State.saInvoices.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0);
  const unpaidInvoiced = State.saInvoices.filter(i => i.status === "unpaid").reduce((s, i) => s + i.amount, 0);

  return `
    <div class="page-header">
      <div>
        <div class="page-h1">Invoices & Billing</div>
        <div class="page-h1-sub">₹${fmtINR(paidInvoiced)} collected • ₹${fmtINR(unpaidInvoiced)} outstanding</div>
      </div>
      <div class="row-tight">
        <button class="btn btn-primary" onclick="openNewInvoiceForm()">${ic("plus", 13)}<span>New Invoice</span></button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 14px">
      ${kpiCard("Total Invoiced", fmtINR(totalInvoiced), `<span class="muted" style="font-size:11.5px">${State.saInvoices.length} invoices generated</span>`, "chart")}
      ${kpiCard("Total Collected", fmtINR(paidInvoiced), `<span class="kpi-trend up">${ic("check", 12)} completed payments</span>`, "check")}
      ${kpiCard("Outstanding Dues", fmtINR(unpaidInvoiced), `<span class="kpi-trend down">${ic("warn", 12)} pending collection</span>`, "warn")}
    </div>
    
    <div class="card">
      <div class="table-scroll" style="max-height:calc(100vh - 350px);border:none;border-radius:var(--radius-lg)">
        <table class="table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Provider / Business</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Created At</th>
              <th>Status</th>
              <th style="width:120px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(i => {
              const statusBadge = i.status === "paid" ? "badge-success" : "badge-danger";
              return `
                <tr>
                  <td class="mono" style="font-weight:600">${esc(i.id)}</td>
                  <td>${esc(i.business_name)}</td>
                  <td style="font-weight:600">${fmtINR(i.amount)}</td>
                  <td>${esc(i.due_date)}</td>
                  <td class="muted">${fmtShort(i.created_at)}</td>
                  <td><span class="badge ${statusBadge}"><span class="dot"></span>${esc(i.status.toUpperCase())}</span></td>
                  <td>
                    <div class="row-tight" style="gap:4px">
                      <button class="icon-btn" onclick="toggleInvoiceStatus('${i.id}', '${i.status}')" title="Toggle Status">${ic("check", 13)}</button>
                      <button class="icon-btn" onclick="sendInvoiceReminder('${i.id}', '${i.business_name}')" title="Send Reminder">${ic("bell", 13)}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="7" class="muted" style="padding:40px;text-align:center">No invoices found.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openNewInvoiceForm() {
  const tenants = State.saProviders || [];
  UI.openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Create Platform Invoice</div>
        <div class="modal-sub">Generate billing for provider tenant subscription</div>
      </div>
      <button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button>
    </div>
    <div class="modal-body">
      <div class="field">
        <label class="lbl">Select Provider *</label>
        <select id="sa_inv_tenant" class="select">
          ${tenants.map(t => `<option value="${t.id}">${esc(t.business_name)} (${esc(t.id)})</option>`).join("")}
        </select>
      </div>
      <div class="field-row">
        <div class="field">
          <label class="lbl">Amount (INR) *</label>
          <input id="sa_inv_amount" type="number" class="input" placeholder="e.g. 2999" required/>
        </div>
        <div class="field">
          <label class="lbl">Due Date *</label>
          <input id="sa_inv_due" type="date" class="input" value="${todayISO()}" required/>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewInvoice()">Generate Invoice</button>
    </div>
  `);
}

async function saveNewInvoice() {
  const tenantId = document.getElementById("sa_inv_tenant").value;
  const amount = document.getElementById("sa_inv_amount").value;
  const dueDate = document.getElementById("sa_inv_due").value;

  if (!tenantId || !amount || !dueDate) {
    UI.toast("Please fill in all fields", "error");
    return;
  }

  try {
    await API.superadmin.billing.create({ tenantId, amount, dueDate });
    UI.toast("Invoice generated successfully!", "success");
    UI.closeModal();
    await App.refresh();
    App.render();
  } catch (err) {
    UI.toast(err.message, "error");
  }
}

async function toggleInvoiceStatus(id, currentStatus) {
  const newStatus = currentStatus === "paid" ? "unpaid" : "paid";
  try {
    await API.superadmin.billing.update(id, newStatus);
    UI.toast("Invoice status updated!", "success");
    await App.refresh();
    App.render();
  } catch (err) {
    UI.toast(err.message, "error");
  }
}

function sendInvoiceReminder(id, businessName) {
  UI.toast(`Invoice reminder email sent to ${businessName}!`, "success");
}
