/* UI primitives: toast, modal, popover, confirm, command palette, theme, notifications */
const UI = {};

UI.toast = function (msg, kind = "") {
  const el = document.createElement("div");
  el.className = "toast " + kind;
  el.innerHTML = `${kind === "success" ? ic("check", 14) : kind === "error" ? ic("warn", 14) : ic("info", 14)} <span>${esc(msg)}</span>`;
  document.getElementById("toastRoot").appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    el.style.transition = "all .2s";
    setTimeout(() => el.remove(), 220);
  }, 2400);
};

UI.openModal = function (html, size = "md") {
  const sz = size === "lg" ? "modal-lg" : size === "xl" ? "modal-xl" : size === "sm" ? "" : "modal-md";
  document.getElementById("modalRoot").innerHTML = `<div class="modal-bg" onclick="if(event.target===this)UI.closeModal()"><div class="modal ${sz}">${html}</div></div>`;
  document.body.style.overflow = "hidden";
};
UI.closeModal = function () { document.getElementById("modalRoot").innerHTML = ""; document.body.style.overflow = ""; };
UI.closePopover = function () { document.getElementById("popoverRoot").innerHTML = ""; };

UI.confirm = function (msg, onYes, danger = false) {
  UI.openModal(`
    <div class="modal-head"><div><div class="modal-title">Are you sure?</div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">${esc(msg)}</div>
    <div class="modal-foot"><div class="spacer"></div><button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button><button class="btn ${danger ? "btn-danger" : "btn-primary"}" onclick="UI._yes()">Confirm</button></div>
  `, "sm");
  UI._yes = () => { UI.closeModal(); onYes(); };
};

UI.applyTheme = function () {
  document.documentElement.setAttribute("data-theme", State.theme);
  const b = document.getElementById("themeBtn");
  if (b) b.innerHTML = State.theme === "dark" ? ic("sun", 18) : ic("moon", 18);
};
UI.toggleTheme = function () {
  State.theme = State.theme === "dark" ? "light" : "dark";
  localStorage.setItem("dabbabox_theme", State.theme);
  UI.applyTheme();
};

/* Empty-state helper */
function emptyState(icon, title, sub, btnLabel, btnAction) {
  return `<div class="empty"><div class="empty-icon">${ic(icon, 24)}</div><div class="empty-title">${esc(title)}</div><div class="empty-sub">${esc(sub)}</div>${btnLabel ? `<button class="btn btn-primary" onclick="${btnAction}">${ic("plus", 13)}<span>${esc(btnLabel)}</span></button>` : ""}</div>`;
}
function kpiCard(label, value, sub, iconName) {
  return `<div class="kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${value}</div><div class="kpi-trend">${sub || ""}</div><div class="kpi-spark" style="color:var(--c-brand-tint)">${ic(iconName || "chart", 56)}</div></div>`;
}

/* ---- Command palette ---- */
let CMDK_IDX = 0, CMDK_FILTERED = [];
UI.openCmdK = function () {
  const items = [
    ...ROUTES.map(r => ({ label: `Go to ${r.label}`, icon: r.icon, kind: "Navigate", action: () => App.go(r.id) })),
    { label: "New customer",         icon: "plus",    kind: "Create", action: () => openCustomerForm() },
    { label: "New order",            icon: "plus",    kind: "Create", action: () => openOrderForm() },
    { label: "New subscription",     icon: "plus",    kind: "Create", action: () => openSubForm() },
    { label: "New product",          icon: "plus",    kind: "Create", action: () => openProductForm() },
    { label: "New lead",             icon: "plus",    kind: "Create", action: () => openLeadForm() },
    { label: "New delivery partner", icon: "plus",    kind: "Create", action: () => openPartnerForm() },
    { label: "Simulate WhatsApp message", icon: "message", kind: "Demo", action: () => simulateWhatsApp() },
    { label: "Toggle dark mode",     icon: "moon",    kind: "System", action: () => UI.toggleTheme() },
    { label: "Sign out",             icon: "x",       kind: "System", action: () => Auth.logout() },
  ];
  CMDK_IDX = 0; CMDK_FILTERED = items;
  const root = document.getElementById("cmdkRoot");
  root.innerHTML = `<div class="cmd-bg" onclick="if(event.target===this)UI.closeCmdK()"><div class="cmd"><div class="cmd-input">${ic("command", 18)}<input id="cmdkInput" placeholder="Type a command or search…" oninput="UI._cmdkFilter(this.value)" onkeydown="UI._cmdkKey(event)" autofocus/><span class="kbd">esc</span></div><div class="cmd-list" id="cmdkList"></div></div></div>`;
  UI._cmdkRender();
  setTimeout(() => document.getElementById("cmdkInput").focus(), 20);
  UI._cmdkItems = items;
};
UI.closeCmdK = function () { document.getElementById("cmdkRoot").innerHTML = ""; };
UI._cmdkFilter = function (q) {
  const Q = q.trim().toLowerCase();
  CMDK_FILTERED = UI._cmdkItems.filter(i => !Q || i.label.toLowerCase().includes(Q) || i.kind.toLowerCase().includes(Q));
  CMDK_IDX = 0; UI._cmdkRender();
};
UI._cmdkRender = function () {
  const l = document.getElementById("cmdkList"); if (!l) return;
  if (!CMDK_FILTERED.length) { l.innerHTML = '<div class="empty" style="padding:30px"><div class="empty-sub">No matches</div></div>'; return; }
  l.innerHTML = CMDK_FILTERED.map((i, idx) => `<div class="cmd-item ${idx === CMDK_IDX ? "active" : ""}" data-idx="${idx}" onclick="UI._cmdkRun(${idx})">${ic(i.icon || "arrowRight", 16)}<span>${esc(i.label)}</span><span class="meta">${esc(i.kind)}</span></div>`).join("");
};
UI._cmdkRun = function (idx) { const it = CMDK_FILTERED[idx]; if (!it) return; UI.closeCmdK(); setTimeout(it.action, 40); };
UI._cmdkKey = function (e) {
  if (e.key === "ArrowDown")    { CMDK_IDX = Math.min(CMDK_FILTERED.length - 1, CMDK_IDX + 1); UI._cmdkRender(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { CMDK_IDX = Math.max(0, CMDK_IDX - 1); UI._cmdkRender(); e.preventDefault(); }
  else if (e.key === "Enter")   { UI._cmdkRun(CMDK_IDX); }
  else if (e.key === "Escape")  { UI.closeCmdK(); }
};

/* ---- Notifications popover ---- */
function computeNotifications() {
  const out = []; const today = todayISO();
  State.leads.filter(l => l.followUp && l.followUp <= today && !["converted","lost"].includes(l.stage))
    .forEach(l => out.push({ icon: "target", title: `Follow up: ${l.name}`, sub: `${l.source} • due ${fmtDate(l.followUp)}`, onClick: () => openLeadForm(l.id) }));
  State.orders.filter(o => o.status === "out_for_delivery")
    .forEach(o => { const cu = State.customers.find(c => c.id === o.customerId); out.push({ icon: "truck", title: `Out for delivery — ${cu ? cu.name : "customer"}`, sub: `Order #${o.id.slice(-6).toUpperCase()} • ${fmtINR(o.total)}`, onClick: () => openOrderDetail(o.id) }); });
  State.products.filter(p => p.stock <= p.lowStockAt)
    .forEach(p => out.push({ icon: "warn", title: `Low stock: ${p.name}`, sub: `${p.stock} units remaining`, onClick: () => openProductForm(p.id) }));
  State.subscriptions.filter(s => s.status === "active" && s.nextDelivery === today)
    .forEach(s => { const cu = State.customers.find(c => c.id === s.customerId); out.push({ icon: "repeat", title: `Subscription delivery today: ${s.name}`, sub: `${cu ? cu.name : ""} • ${s.frequency}`, onClick: () => openSubForm(s.id) }); });
  const waU = State.whatsappThreads.reduce((s, t) => s + (t.unread || 0), 0);
  if (waU) out.push({ icon: "message", title: `${waU} unread WhatsApp message${waU === 1 ? "" : "s"}`, sub: "Tap to open inbox", onClick: () => App.go("whatsapp") });
  return out;
}
UI.openNotifications = function (e) {
  if (e) e.stopPropagation();
  const items = computeNotifications();
  const root = document.getElementById("popoverRoot");
  root.innerHTML = `<div class="popover" onclick="event.stopPropagation()"><div class="popover-head"><div class="row-tight">${ic("bell", 16)}<span style="font-weight:600;font-size:14px">Notifications</span></div><span class="chip">${items.length}</span></div><div class="popover-body">${items.length ? items.map((n, i) => `<div class="notif-item" onclick="UI._notifRun(${i})"><div class="notif-icon">${ic(n.icon, 16)}</div><div class="flex-1"><div class="notif-title">${esc(n.title)}</div><div class="notif-sub">${esc(n.sub)}</div></div></div>`).join("") : `<div class="empty" style="padding:30px"><div class="empty-icon">${ic("check", 24)}</div><div class="empty-title">All caught up</div><div class="empty-sub">No pending alerts right now.</div></div>`}</div></div>`;
  UI._notifItems = items;
  setTimeout(() => document.addEventListener("click", UI._notifClose, { once: true }), 0);
  updateBellDot();
};
UI._notifRun = function (i) { const it = UI._notifItems[i]; if (!it) return; UI.closePopover(); setTimeout(it.onClick, 40); };
UI._notifClose = function () { UI.closePopover(); };
function updateBellDot() {
  const items = computeNotifications();
  const btn = document.getElementById("notifBtn"); if (!btn) return;
  btn.innerHTML = ic("bell", 18) + (items.length ? '<span class="dot"></span>' : "");
}
