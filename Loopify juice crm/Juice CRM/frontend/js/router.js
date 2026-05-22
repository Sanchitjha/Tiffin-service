/* Router + nav + global state refresh */
const App = {
  async go(route) {
    State.route = route; State.search = "";
    window.location.hash = route;
    const r = ROUTES.find(x => x.id === route);
    document.getElementById("pageTitle").textContent = r ? r.label : "";
    document.getElementById("globalSearch").value = "";
    if (window.innerWidth <= 800) document.getElementById("sidebar").classList.remove("open");
    renderNav();
    await App.refreshFor(route);
    App.render();
    UI.closePopover();
  },
  async refresh() { await App.refreshFor(State.route); },
  async refreshFor(route) {
    const tasks = [];
    if (["dashboard","customers","reports","whatsapp","calendar","orders","leads","subscriptions","partners","products"].includes(route)) {
      tasks.push(API.customers.list().then(d => State.customers = d).catch(()=>{}));
      tasks.push(API.orders.list().then(d => State.orders = d).catch(()=>{}));
      tasks.push(API.products.list().then(d => State.products = d).catch(()=>{}));
      tasks.push(API.partners.list().then(d => State.partners = d).catch(()=>{}));
      tasks.push(API.subscriptions.list().then(d => State.subscriptions = d).catch(()=>{}));
      tasks.push(API.leads.list().then(d => State.leads = d).catch(()=>{}));
      tasks.push(API.whatsapp.threads().then(d => State.whatsappThreads = d).catch(()=>{}));
    }
    if (route === "dashboard") tasks.push(API.reports.activity(20).then(d => State.activity = d).catch(()=>{}));
    if (route === "settings") tasks.push(API.settings.all().then(d => { State.settings = d || {}; if (d && d.business) State.business = { ...State.business, ...d.business }; }).catch(()=>{}));
    await Promise.all(tasks);
  },
  render() {
    const c = document.getElementById("content");
    const fn = { dashboard: pageDashboard, customers: pageCustomers, orders: pageOrders, subscriptions: pageSubscriptions, products: pageProducts, leads: pageLeads, partners: pagePartners, whatsapp: pageWhatsapp, calendar: pageCalendar, reports: pageReports, settings: pageSettings }[State.route];
    try {
      c.innerHTML = fn ? fn() : '<div class="empty"><div class="empty-title">Not found</div></div>';
      if (fn && fn.after) setTimeout(fn.after, 0);
    } catch (e) { console.error(e); c.innerHTML = `<div class="empty"><div class="empty-title">Error</div><div class="empty-sub">${esc(e.message)}</div></div>`; }
    updateBellDot();
  },
  search: debounce(function (v) {
    State.search = (v || "").trim().toLowerCase();
    if (["customers","orders","leads","subscriptions","whatsapp","products"].includes(State.route)) App.render();
  }, 120),
  quickAdd() {
    const map = { customers: openCustomerForm, orders: openOrderForm, subscriptions: openSubForm, products: openProductForm, leads: openLeadForm, partners: openPartnerForm, whatsapp: simulateWhatsApp };
    (map[State.route] || openCustomerForm)();
  },
};

function renderNav() {
  const nav = document.getElementById("nav");
  const grouped = {};
  ROUTES.forEach(r => (grouped[r.section] = grouped[r.section] || []).push(r));
  let html = "";
  for (const [section, items] of Object.entries(grouped)) {
    html += `<div class="nav-section">${section}</div>`;
    items.forEach(r => {
      let pill = "";
      if (r.id === "whatsapp") { const u = State.whatsappThreads.reduce((s, t) => s + (t.unread || 0), 0); if (u) pill = `<span class="chip" style="background:var(--c-brand);color:#fff;border:none">${u}</span>`; }
      if (r.id === "leads")    { const c = State.leads.filter(l => !["converted","lost"].includes(l.stage)).length; if (c) pill = `<span class="chip">${c}</span>`; }
      html += `<div class="nav-item ${State.route === r.id ? "active" : ""}" onclick="App.go('${r.id}')">${ic(r.icon, 18)}<span>${r.label}</span>${pill}</div>`;
    });
  }
  nav.innerHTML = html;
}
function thSort(label, key, sortState) { const sorted = sortState.key === key; return `<th class="${sorted ? "sorted" : ""}" onclick="sortToggle('cust','${key}')">${esc(label)}<span class="sort-ico">${sorted ? (sortState.dir === "asc" ? ic("chevronUp", 10) : ic("chevronDown", 10)) : ic("chevronDown", 10)}</span></th>`; }
function sortToggle(scope, key) {
  const state = { cust: CUST_SORT, ord: ORDER_SORT }[scope];
  if (state.key === key) state.dir = state.dir === "asc" ? "desc" : "asc";
  else { state.key = key; state.dir = "asc"; }
  App.render();
}
