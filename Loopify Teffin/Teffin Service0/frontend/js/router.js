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
  async refresh() { await App.refresh(); },
  async refreshFor(route) {
    const tasks = [];
    if (route.startsWith("sa-")) {
      if (route === "sa-dashboard") {
        tasks.push(API.superadmin.analytics().then(d => State.saAnalytics = d).catch(()=>{}));
        tasks.push(API.superadmin.tickets().then(d => State.saTickets = d).catch(()=>{}));
      }
      if (route === "sa-providers") {
        tasks.push(API.superadmin.providers.list().then(d => State.saProviders = d).catch(()=>{}));
      }
      if (route === "sa-billing") {
        tasks.push(API.superadmin.providers.list().then(d => State.saProviders = d).catch(()=>{}));
        tasks.push(API.superadmin.billing.list().then(d => State.saInvoices = d).catch(()=>{}));
      }
      if (route === "sa-tickets") {
        tasks.push(API.superadmin.tickets().then(d => State.saTickets = d).catch(()=>{}));
      }
      if (route === "sa-settings") {
        tasks.push(API.superadmin.settings.get().then(d => State.saSettings = d).catch(()=>{}));
      }
    } else {
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
    }
    await Promise.all(tasks);
  },
  render() {
    const c = document.getElementById("content");
    const fn = { 
      dashboard: pageDashboard, 
      customers: pageCustomers, 
      orders: pageOrders, 
      subscriptions: pageSubscriptions, 
      products: pageProducts, 
      leads: pageLeads, 
      partners: pagePartners, 
      whatsapp: pageWhatsapp, 
      calendar: pageCalendar, 
      reports: pageReports, 
      settings: pageSettings,
      "sa-dashboard": pageSaDashboard,
      "sa-providers": pageSaProviders,
      "sa-billing": pageSaBilling,
      "sa-tickets": pageSaTickets,
      "sa-settings": pageSaSettings
    }[State.route];
    try {
      c.innerHTML = fn ? fn() : '<div class="empty"><div class="empty-title">Not found</div></div>';
      
      const qaBtn = document.getElementById("quickAddBtn");
      if (qaBtn) {
        if (State.user && State.user.role === 'superadmin') {
          if (State.route === 'sa-providers') {
            qaBtn.style.display = 'flex';
            qaBtn.querySelector('span:last-child').textContent = 'New Provider';
          } else if (State.route === 'sa-billing') {
            qaBtn.style.display = 'flex';
            qaBtn.querySelector('span:last-child').textContent = 'New Invoice';
          } else {
            qaBtn.style.display = 'none';
          }
        } else {
          qaBtn.style.display = 'flex';
          qaBtn.querySelector('span:last-child').textContent = 'New';
        }
      }

      if (fn && fn.after) setTimeout(fn.after, 0);
    } catch (e) { console.error(e); c.innerHTML = `<div class="empty"><div class="empty-title">Error</div><div class="empty-sub">${esc(e.message)}</div></div>`; }
    updateBellDot();
  },
  search: debounce(function (v) {
    State.search = (v || "").trim().toLowerCase();
    if (["customers","orders","leads","subscriptions","whatsapp","products","sa-providers","sa-billing","sa-tickets"].includes(State.route)) App.render();
  }, 120),
  quickAdd() {
    if (State.user && State.user.role === 'superadmin') {
      if (State.route === 'sa-providers') openNewProviderForm();
      if (State.route === 'sa-billing') openNewInvoiceForm();
      return;
    }
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
      if (r.id === "sa-tickets") { const u = State.saTickets.filter(t => t.status === "open").length; if (u) pill = `<span class="chip" style="background:var(--c-brand);color:#fff;border:none">${u}</span>`; }
      html += `<div class="nav-item ${State.route === r.id ? "active" : ""}" onclick="App.go('${r.id}')">${ic(r.icon, 18)}<span>${r.label}</span>${pill}</div>`;
    });
  }
  nav.innerHTML = html;

  const brandSub = document.querySelector(".brand-sub");
  if (brandSub) {
    brandSub.textContent = (State.user && State.user.role === "superadmin") ? "Super Admin Portal" : "Tiffin Service CRM";
  }
}
function thSort(label, key, sortState) { const sorted = sortState.key === key; return `<th class="${sorted ? "sorted" : ""}" onclick="sortToggle('cust','${key}')">${esc(label)}<span class="sort-ico">${sorted ? (sortState.dir === "asc" ? ic("chevronUp", 10) : ic("chevronDown", 10)) : ic("chevronDown", 10)}</span></th>`; }
function sortToggle(scope, key) {
  const state = { cust: CUST_SORT, ord: ORDER_SORT }[scope];
  if (state.key === key) state.dir = state.dir === "asc" ? "desc" : "asc";
  else { state.key = key; state.dir = "asc"; }
  App.render();
}
