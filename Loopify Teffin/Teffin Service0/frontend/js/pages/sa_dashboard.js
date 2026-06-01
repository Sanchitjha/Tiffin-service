/* =========================================================================
   Super Admin Dashboard Page
   ========================================================================= */
function pageSaDashboard() {
  const sa = State.saAnalytics || { totalTenants: 0, activeTenants: 0, trialTenants: 0, totalRevenue: 0, totalCustomers: 0, totalOrders: 0, revenueHistory: [] };
  const ticketsOpen = State.saTickets.filter(t => t.status === "open").length;
  const ticketsClosed = State.saTickets.filter(t => t.status === "closed").length;

  return `
    <div class="kpi-grid">
      ${kpiCard("Total Providers", String(sa.totalTenants), `<span class="muted" style="font-size:11.5px">${sa.activeTenants} active • ${sa.trialTenants} on trial</span>`, "users")}
      ${kpiCard("Total Revenue (Paid)", fmtINR(sa.totalRevenue), `<span class="muted" style="font-size:11.5px">subscription billing</span>`, "chart")}
      ${kpiCard("Platform Customers", String(sa.totalCustomers), `<span class="muted" style="font-size:11.5px">across all providers</span>`, "users")}
      ${kpiCard("Platform Orders", String(sa.totalOrders), `<span class="muted" style="font-size:11.5px">processed all-time</span>`, "package")}
      ${kpiCard("Open Tickets", String(ticketsOpen), ticketsOpen > 0 ? `<span class="badge badge-danger">Needs response</span>` : `<span class="badge badge-success">All resolved</span>`, "message")}
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">SaaS Platform Revenue</div>
            <div class="card-sub">Completed monthly subscription billing (aggregate)</div>
          </div>
        </div>
        <div class="card-pad"><canvas id="chartSaRev" height="110"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head">
          <div class="card-title">Support Tickets</div>
          <div class="card-sub">Provider ticketing overview</div>
        </div>
        <div class="card-pad"><canvas id="chartSaTickets" height="170"></canvas></div>
      </div>
    </div>
  `;
}

pageSaDashboard.after = function () {
  const sa = State.saAnalytics || { revenueHistory: [] };
  const cs = getComputedStyle(document.documentElement);
  const brand = cs.getPropertyValue("--c-brand").trim() || "#4a7c59";
  const accent = cs.getPropertyValue("--c-accent").trim() || "#f9a620";
  const ink2 = cs.getPropertyValue("--c-muted").trim();
  const grid = cs.getPropertyValue("--c-border").trim();
  
  // 1. Billing Trend Chart
  const months = sa.revenueHistory.map(h => h.month) || [];
  const vals = sa.revenueHistory.map(h => h.amount) || [];
  
  if (window._chSaRev) window._chSaRev.destroy();
  window._chSaRev = new Chart(document.getElementById("chartSaRev"), {
    type: "bar",
    data: {
      labels: months.length ? months : ["Jan", "Feb", "Mar", "Apr", "May"],
      datasets: [{ 
        label: "Subscription Revenue", 
        data: vals.length ? vals : [0, 0, 0, 0, 0], 
        backgroundColor: brand, 
        borderRadius: 6, 
        maxBarThickness: 30 
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: ink2, font: { size: 10 } } },
        y: { grid: { color: grid }, ticks: { color: ink2, font: { size: 10 }, callback: v => "₹" + v } }
      }
    }
  });

  // 2. Tickets Doughnut Chart
  const ticketsOpen = State.saTickets.filter(t => t.status === "open").length;
  const ticketsClosed = State.saTickets.filter(t => t.status === "closed").length;
  
  if (window._chSaTickets) window._chSaTickets.destroy();
  window._chSaTickets = new Chart(document.getElementById("chartSaTickets"), {
    type: "doughnut",
    data: {
      labels: ["Open", "Resolved"],
      datasets: [{
        data: [ticketsOpen || 0, ticketsClosed || 0],
        backgroundColor: [accent, brand],
        borderColor: cs.getPropertyValue("--c-surface").trim(),
        borderWidth: 2
      }]
    },
    options: {
      cutout: "68%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 9, color: ink2, font: { size: 11 } } }
      }
    }
  });
};
