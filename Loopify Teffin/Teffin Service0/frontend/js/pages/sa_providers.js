/* =========================================================================
   Super Admin Providers Page
   ========================================================================= */
function pageSaProviders() {
  const q = State.search;
  let list = State.saProviders || [];
  
  if (q) {
    list = list.filter(p => 
      p.id.toLowerCase().includes(q) ||
      p.business_name.toLowerCase().includes(q) ||
      p.owner_name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.phone.includes(q) ||
      p.city.toLowerCase().includes(q) ||
      p.area.toLowerCase().includes(q)
    );
  }

  return `
    <div class="page-header">
      <div>
        <div class="page-h1">Providers & Tenants</div>
        <div class="page-h1-sub">${list.length} of ${State.saProviders.length} registered tiffin businesses</div>
      </div>
      <div class="row-tight">
        <button class="btn btn-primary" onclick="openNewProviderForm()">${ic("plus", 13)}<span>Add Provider</span></button>
      </div>
    </div>
    
    <div class="card">
      <div class="table-scroll" style="max-height:calc(100vh - 220px);border:none;border-radius:var(--radius-lg)">
        <table class="table">
          <thead>
            <tr>
              <th>Business / Tenant ID</th>
              <th>Owner / Contact</th>
              <th>Locality</th>
              <th>WhatsApp Number</th>
              <th>Plan</th>
              <th>Usage Stats</th>
              <th>Status</th>
              <th style="width:160px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(p => {
              let planBadge = "badge-neutral";
              if (p.plan === "monthly") planBadge = "badge-info";
              if (p.plan === "yearly") planBadge = "badge-purple";
              
              let statusBadge = "badge-neutral";
              if (p.status === "active") statusBadge = "badge-success";
              if (p.status === "trial") statusBadge = "badge-accent";
              if (p.status === "suspended") statusBadge = "badge-danger";

              const trialEnds = p.trial_ends_at ? fmtShort(p.trial_ends_at) : "N/A";
              
              return `
                <tr>
                  <td>
                    <div style="font-weight:600">${esc(p.business_name)}</div>
                    <div class="muted mono" style="font-size:11px">${esc(p.id)}</div>
                  </td>
                  <td>
                    <div style="font-weight:500">${esc(p.owner_name)}</div>
                    <div class="muted" style="font-size:11.5px">${esc(p.email)} • ${esc(p.phone)}</div>
                  </td>
                  <td>${esc(p.area)}, ${esc(p.city)}</td>
                  <td class="mono" style="font-size:12px">${esc(p.whatsapp_number || "—")}</td>
                  <td>
                    <span class="badge ${planBadge}">${esc(p.plan.toUpperCase())}</span>
                    ${p.status === "trial" ? `<div class="muted" style="font-size:10px;margin-top:2px">Ends: ${trialEnds}</div>` : ""}
                  </td>
                  <td style="font-size:12.5px">
                    <span style="font-weight:600">${p.stats?.customersCount || 0}</span> cust • 
                    <span style="font-weight:600">${p.stats?.ordersCount || 0}</span> orders
                  </td>
                  <td><span class="badge ${statusBadge}"><span class="dot"></span>${esc(p.status.toUpperCase())}</span></td>
                  <td>
                    <div class="row-tight" style="gap:4px">
                      <button class="icon-btn" onclick="openEditProviderModal('${p.id}')" title="Edit Profile">${ic("edit", 13)}</button>
                      <button class="icon-btn" onclick="toggleSuspendProvider('${p.id}', '${p.status}')" title="${p.status === 'suspended' ? 'Unsuspend' : 'Suspend'}">${ic(p.status === 'suspended' ? 'check' : 'warn', 13)}</button>
                      <button class="icon-btn" onclick="downloadProviderDb('${p.id}')" title="Download DB Backup">${ic("download", 13)}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="8" class="muted" style="padding:40px;text-align:center">No providers found.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openNewProviderForm() {
  UI.openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Onboard New Provider</div>
        <div class="modal-sub">Create provider tenant and default admin account</div>
      </div>
      <button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button>
    </div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field">
          <label class="lbl">Unique Provider ID (Slug) *</label>
          <input id="sa_f_id" class="input" placeholder="e.g. sharma_surat" required/>
          <div class="muted" style="font-size:10px;margin-top:2px">Only letters, numbers, and underscores. Unique folder name.</div>
        </div>
        <div class="field">
          <label class="lbl">Business / Brand Name *</label>
          <input id="sa_f_bizname" class="input" placeholder="e.g. Sharma Tiffin Service" required/>
        </div>
      </div>
      
      <div class="field-row">
        <div class="field">
          <label class="lbl">Owner Name *</label>
          <input id="sa_f_owner" class="input" placeholder="e.g. Rajesh Sharma" required/>
        </div>
        <div class="field">
          <label class="lbl">Initial Password *</label>
          <input id="sa_f_pwd" class="input" type="password" placeholder="Min 6 characters" required/>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="lbl">Admin Email *</label>
          <input id="sa_f_email" class="input" type="email" placeholder="owner@domain.com" required/>
        </div>
        <div class="field">
          <label class="lbl">Contact Phone *</label>
          <input id="sa_f_phone" class="input" placeholder="+91 …" required/>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="lbl">City *</label>
          <input id="sa_f_city" class="input" placeholder="e.g. Surat" required/>
        </div>
        <div class="field">
          <label class="lbl">Area / Locality *</label>
          <input id="sa_f_area" class="input" placeholder="e.g. Adajan" required/>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="lbl">WhatsApp Display Number</label>
          <input id="sa_f_wanum" class="input" placeholder="e.g. +919876500000"/>
        </div>
        <div class="field">
          <label class="lbl">SaaS Billing Plan</label>
          <select id="sa_f_plan" class="select">
            <option value="monthly">Monthly Recurring (₹2,999)</option>
            <option value="yearly">Yearly Saver (₹29,999)</option>
            <option value="trial">Free Trial (14 days)</option>
          </select>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveNewProvider()">Onboard Provider</button>
    </div>
  `, "lg");
  setTimeout(() => document.getElementById("sa_f_id").focus(), 50);
}

async function saveNewProvider() {
  const id = document.getElementById("sa_f_id").value.trim();
  const businessName = document.getElementById("sa_f_bizname").value.trim();
  const ownerName = document.getElementById("sa_f_owner").value.trim();
  const password = document.getElementById("sa_f_pwd").value;
  const email = document.getElementById("sa_f_email").value.trim();
  const phone = document.getElementById("sa_f_phone").value.trim();
  const city = document.getElementById("sa_f_city").value.trim();
  const area = document.getElementById("sa_f_area").value.trim();
  const whatsappNumber = document.getElementById("sa_f_wanum").value.trim();
  const plan = document.getElementById("sa_f_plan").value;

  if (!id || !businessName || !ownerName || !password || !email || !phone || !city || !area) {
    UI.toast("Please fill in all required fields", "error");
    return;
  }
  if (password.length < 6) {
    UI.toast("Password must be at least 6 characters", "error");
    return;
  }

  try {
    await API.superadmin.providers.create({ id, businessName, ownerName, email, phone, city, area, whatsappNumber, password, plan });
    UI.toast("Provider onboarded successfully!", "success");
    UI.closeModal();
    await App.refresh();
    App.render();
  } catch (err) {
    UI.toast(err.message, "error");
  }
}

function openEditProviderModal(id) {
  const p = State.saProviders.find(x => x.id === id);
  if (!p) { UI.toast("Provider not found"); return; }

  UI.openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Edit Provider Profile</div>
        <div class="modal-sub">Modify details for: ${esc(p.business_name)}</div>
      </div>
      <button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button>
    </div>
    <div class="modal-body">
      <div class="field-row">
        <div class="field">
          <label class="lbl">Business Name</label>
          <input id="sa_e_bizname" class="input" value="${esc(p.business_name)}"/>
        </div>
        <div class="field">
          <label class="lbl">Owner Name</label>
          <input id="sa_e_owner" class="input" value="${esc(p.owner_name)}"/>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="lbl">Contact Phone</label>
          <input id="sa_e_phone" class="input" value="${esc(p.phone)}"/>
        </div>
        <div class="field">
          <label class="lbl">WhatsApp display number</label>
          <input id="sa_e_wanum" class="input" value="${esc(p.whatsapp_number || "")}"/>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="lbl">City</label>
          <input id="sa_e_city" class="input" value="${esc(p.city)}"/>
        </div>
        <div class="field">
          <label class="lbl">Area / Locality</label>
          <input id="sa_e_area" class="input" value="${esc(p.area)}"/>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="lbl">Account Status</label>
          <select id="sa_e_status" class="select">
            <option value="trial" ${p.status === "trial" ? "selected" : ""}>Free Trial</option>
            <option value="active" ${p.status === "active" ? "selected" : ""}>Active (Paid)</option>
            <option value="suspended" ${p.status === "suspended" ? "selected" : ""}>Suspended</option>
          </select>
        </div>
        <div class="field">
          <label class="lbl">Billing Plan</label>
          <select id="sa_e_plan" class="select">
            <option value="monthly" ${p.plan === "monthly" ? "selected" : ""}>Monthly</option>
            <option value="yearly" ${p.plan === "yearly" ? "selected" : ""}>Yearly</option>
          </select>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label class="lbl">Trial ends at (Timestamp MS)</label>
          <input id="sa_e_trial_ends" class="input" value="${p.trial_ends_at || ""}"/>
        </div>
        <div class="field">
          <label class="lbl">WhatsApp markup rate (per msg)</label>
          <input id="sa_e_markup" class="input" type="number" step="0.01" value="${p.whatsapp_markup_rate || 0.05}"/>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProviderChanges('${p.id}')">Save Changes</button>
    </div>
  `, "lg");
}

async function saveProviderChanges(id) {
  const body = {
    business_name: document.getElementById("sa_e_bizname").value.trim(),
    owner_name: document.getElementById("sa_e_owner").value.trim(),
    phone: document.getElementById("sa_e_phone").value.trim(),
    whatsapp_number: document.getElementById("sa_e_wanum").value.trim() || null,
    city: document.getElementById("sa_e_city").value.trim(),
    area: document.getElementById("sa_e_area").value.trim(),
    status: document.getElementById("sa_e_status").value,
    plan: document.getElementById("sa_e_plan").value,
    trial_ends_at: document.getElementById("sa_e_trial_ends").value.trim() || null,
    whatsapp_markup_rate: document.getElementById("sa_e_markup").value.trim()
  };

  try {
    await API.superadmin.providers.update(id, body);
    UI.toast("Provider updated successfully!", "success");
    UI.closeModal();
    await App.refresh();
    App.render();
  } catch (err) {
    UI.toast(err.message, "error");
  }
}

async function toggleSuspendProvider(id, currentStatus) {
  const newStatus = currentStatus === "suspended" ? "active" : "suspended";
  const actionText = currentStatus === "suspended" ? "Unsuspend account?" : "Suspend this provider's access to the platform?";
  
  UI.confirm(actionText, async () => {
    try {
      await API.superadmin.providers.update(id, { status: newStatus });
      UI.toast(newStatus === "suspended" ? "Account suspended" : "Account activated", "success");
      await App.refresh();
      App.render();
    } catch (err) {
      UI.toast(err.message, "error");
    }
  }, newStatus === "suspended");
}

function downloadProviderDb(id) {
  const token = localStorage.getItem("dabbabox_token");
  const url = (window.BACKEND_URL || "") + `/api/superadmin/providers/${id}/backup?token=${token}`;
  window.open(url, "_blank");
  UI.toast("Downloading backup file...", "info");
}
