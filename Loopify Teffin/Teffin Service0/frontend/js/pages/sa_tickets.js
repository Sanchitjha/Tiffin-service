/* =========================================================================
   Super Admin Support Tickets Page
   ========================================================================= */
function pageSaTickets() {
  const q = State.search;
  let list = State.saTickets || [];
  
  if (q) {
    list = list.filter(t => 
      t.id.toLowerCase().includes(q) ||
      t.business_name.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q)
    );
  }

  return `
    <div class="page-header">
      <div>
        <div class="page-h1">Support Tickets</div>
        <div class="page-h1-sub">${list.filter(t => t.status === "open").length} open queries from providers</div>
      </div>
    </div>
    
    <div class="card">
      <div class="table-scroll" style="max-height:calc(100vh - 220px);border:none;border-radius:var(--radius-lg)">
        <table class="table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Provider / Business</th>
              <th>Subject</th>
              <th>Description</th>
              <th>Created At</th>
              <th>Status</th>
              <th style="width:120px">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${list.length ? list.map(t => {
              const statusBadge = t.status === "open" ? "badge-accent" : "badge-success";
              return `
                <tr>
                  <td class="mono" style="font-weight:600">${esc(t.id)}</td>
                  <td>${esc(t.business_name)}</td>
                  <td style="font-weight:600">${esc(t.subject)}</td>
                  <td style="font-size:12.5px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.description)}</td>
                  <td class="muted">${fmtShort(t.created_at)}</td>
                  <td><span class="badge ${statusBadge}"><span class="dot"></span>${esc(t.status.toUpperCase())}</span></td>
                  <td>
                    <div class="row-tight" style="gap:4px">
                      <button class="icon-btn" onclick="openTicketDetailModal('${t.id}')" title="View & Reply">${ic("message", 13)}</button>
                      <button class="icon-btn" onclick="toggleTicketStatus('${t.id}', '${t.status}')" title="${t.status === 'open' ? 'Close Ticket' : 'Re-open Ticket'}">${ic("check", 13)}</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="7" class="muted" style="padding:40px;text-align:center">No support tickets found.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function openTicketDetailModal(id) {
  const t = State.saTickets.find(x => x.id === id);
  if (!t) { UI.toast("Ticket not found"); return; }
  
  UI.openModal(`
    <div class="modal-head">
      <div>
        <div class="modal-title">Ticket: ${esc(t.id)}</div>
        <div class="modal-sub">Submitted by: ${esc(t.business_name)}</div>
      </div>
      <button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button>
    </div>
    <div class="modal-body" style="display:flex;flex-direction:column;gap:12px">
      <div>
        <div style="font-weight:600;font-size:14px;margin-bottom:4px">Subject: ${esc(t.subject)}</div>
        <div style="font-size:13px;color:var(--c-ink-2);background:var(--c-surface-2);padding:12px;border-radius:8px;border:1px solid var(--c-border);line-height:1.5">
          ${esc(t.description)}
        </div>
      </div>
      <div class="field">
        <label class="lbl">Response Message</label>
        <textarea id="sa_ticket_reply" class="textarea" rows="4" placeholder="Type your support response..."></textarea>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-secondary" onclick="UI.closeModal()">Close</button>
      <button class="btn btn-primary" onclick="sendTicketReply('${t.id}')">Send Reply</button>
    </div>
  `);
}

async function sendTicketReply(id) {
  const reply = document.getElementById("sa_ticket_reply").value.trim();
  if (!reply) {
    UI.toast("Please type a response message", "error");
    return;
  }
  
  // Simulate support ticket reply
  UI.toast("Response sent to the provider!", "success");
  UI.closeModal();
}

async function toggleTicketStatus(id, currentStatus) {
  const newStatus = currentStatus === "open" ? "closed" : "open";
  try {
    await API.superadmin.tickets.update(id, newStatus);
    UI.toast(newStatus === "closed" ? "Ticket marked as resolved" : "Ticket re-opened", "success");
    await App.refresh();
    App.render();
  } catch (err) {
    UI.toast(err.message, "error");
  }
}
