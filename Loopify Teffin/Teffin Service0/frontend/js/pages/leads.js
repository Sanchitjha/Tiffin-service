let DRAG_LEAD = null;

function pageLeads() {
  const q = State.search;
  const list = State.leads.filter(l => !q || l.name.toLowerCase().includes(q) || (l.phone || "").includes(q) || (l.source || "").toLowerCase().includes(q));
  const today = todayISO();
  const overdue = list.filter(l => l.followUp && l.followUp < today && !["converted","lost"].includes(l.stage)).length;
  const todayCount = list.filter(l => l.followUp === today && !["converted","lost"].includes(l.stage)).length;
  return `
    <div class="page-header"><div><div class="page-h1">Leads & follow-ups</div><div class="page-h1-sub">${list.length} leads ${overdue ? `• ${overdue} overdue` : ""} ${todayCount ? `• ${todayCount} due today` : ""}</div></div><button class="btn btn-primary" onclick="openLeadForm()">${ic("plus", 13)}<span>New lead</span></button></div>
    <div class="kanban scroll">
    ${LEAD_STAGES.map(st => { const items = list.filter(l => l.stage === st.id); return `<div class="kanban-col" data-stage="${st.id}" ondragover="event.preventDefault();this.classList.add('over')" ondragleave="this.classList.remove('over')" ondrop="dropLead(event,'${st.id}')">
      <div class="kanban-head"><div class="title"><span class="badge ${st.badge}"><span class="dot"></span>${esc(st.label)}</span></div><span class="chip">${items.length}</span></div>
      <div class="kanban-list">
        ${items.length ? items.map(l => { const od = l.followUp && l.followUp < today; return `<div class="lead-card" draggable="true" ondragstart="DRAG_LEAD='${l.id}';this.classList.add('dragging')" ondragend="DRAG_LEAD=null;this.classList.remove('dragging')" onclick="openLeadForm('${l.id}')">
          <div class="lead-name">${esc(l.name)}</div>
          ${l.phone ? `<div class="lead-phone">${esc(l.phone)}</div>` : ""}
          <div class="lead-meta">${l.source ? `<span class="chip">${esc(l.source)}</span>` : "<span></span>"}${l.followUp ? `<span class="muted" style="font-size:11px;${od ? "color:var(--c-danger);font-weight:600" : ""}">${ic("clock", 11)} ${fmtShort(l.followUp)}</span>` : ""}</div>
        </div>`; }).join("") : '<div class="muted" style="text-align:center;padding:12px;font-size:12px">Drop leads here</div>'}
      </div>
    </div>`; }).join("")}
    </div>`;
}

async function dropLead(e, newStage) {
  e.preventDefault(); e.currentTarget.classList.remove("over");
  if (!DRAG_LEAD) return;
  const l = State.leads.find(x => x.id === DRAG_LEAD); if (!l || l.stage === newStage) return;
  try { await API.leads.patchStage(l.id, newStage); await App.refresh(); UI.toast("Lead moved", "success"); App.render(); renderNav(); }
  catch (e) { UI.toast(e.message, "error"); }
}

function openLeadForm(id) {
  const l = id ? State.leads.find(x => x.id === id) : { id: "", name: "", phone: "", source: "WhatsApp Bot", stage: "new", followUp: daysFromNow(1), notes: "" };
  if (id && !l) { UI.toast("Not found"); return; }
  UI.openModal(`
    <div class="modal-head"><div><div class="modal-title">${id ? "Edit lead" : "New lead"}</div><div class="modal-sub">Track this opportunity</div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="field"><label class="lbl">Name *</label><input id="f_name" class="input" value="${esc(l.name)}"/></div>
      <div class="field-row">
        <div class="field"><label class="lbl">Phone</label><input id="f_phone" class="input" value="${esc(l.phone || "")}"/></div>
        <div class="field"><label class="lbl">Source</label><select id="f_source" class="select">${["WhatsApp Bot","Instagram","Walk-in","Referral","Website","Phone call","Other"].map(o => `<option ${o === l.source ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label class="lbl">Stage</label><select id="f_stage" class="select">${LEAD_STAGES.map(s => `<option value="${s.id}" ${s.id === l.stage ? "selected" : ""}>${s.label}</option>`).join("")}</select></div>
        <div class="field"><label class="lbl">Follow-up date</label><input id="f_fu" class="input" type="date" value="${esc(l.followUp || "")}"/></div>
      </div>
      <div class="field"><label class="lbl">Notes</label><textarea id="f_notes" class="textarea" rows="3">${esc(l.notes || "")}</textarea></div>
    </div>
    <div class="modal-foot">
      ${id ? `<button class="btn btn-danger" onclick="deleteLead('${l.id}')">${ic("trash", 13)}<span>Delete</span></button>` : ""}
      ${id ? `<button class="btn btn-secondary" onclick="convertLead('${l.id}')">${ic("arrowRight", 13)}<span>Convert to customer</span></button>` : ""}
      <div class="spacer"></div><button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveLead('${l.id}')">${ic("check", 13)}<span>Save</span></button>
    </div>`);
}

async function saveLead(id) {
  const name = document.getElementById("f_name").value.trim();
  if (!name) { UI.toast("Name required", "error"); return; }
  const body = {
    name,
    phone: document.getElementById("f_phone").value.trim(),
    source: document.getElementById("f_source").value,
    stage: document.getElementById("f_stage").value,
    followUp: document.getElementById("f_fu").value,
    notes: document.getElementById("f_notes").value.trim(),
  };
  try { if (id) await API.leads.update(id, body); else await API.leads.create(body); await App.refresh(); UI.closeModal(); UI.toast("Lead saved", "success"); App.render(); renderNav(); }
  catch (e) { UI.toast(e.message, "error"); }
}
function deleteLead(id) { UI.confirm("Delete this lead?", async () => { try { await API.leads.delete(id); await App.refresh(); UI.closeModal(); UI.toast("Deleted", "success"); App.render(); renderNav(); } catch (e) { UI.toast(e.message, "error"); } }, true); }
async function convertLead(id) {
  try { await API.leads.convert(id); await App.refresh(); UI.closeModal(); UI.toast("Converted to customer", "success"); App.render(); renderNav(); }
  catch (e) { UI.toast(e.message, "error"); }
}
