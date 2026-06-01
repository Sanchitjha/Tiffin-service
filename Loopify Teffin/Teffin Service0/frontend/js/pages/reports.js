let REPORT_RANGE = 30, REPORT_DATA = null, REPORT_TAB = "overview";
let AREA_DATA = null, COOK_DATA = null, CUST_DATA = null;

/* ── helpers ── */
function trendChip(val) {
  if (val === 0) return '<span class="muted" style="font-size:11px">—</span>';
  return `<span style="font-size:11.5px;font-weight:600;color:${val > 0 ? "var(--c-success)" : "var(--c-danger)"}">${val > 0 ? "↑" : "↓"}${Math.abs(val)}%</span>`;
}
function dietBadge(pref) {
  if (!pref || !pref.dietaryType) return "";
  const colors = { Veg: "badge-success", "Non-Veg": "badge-danger", Jain: "badge-info", Diet: "badge-purple", Vegan: "badge-success" };
  return `<span class="badge ${colors[pref.dietaryType] || "badge-neutral"}">${esc(pref.dietaryType)}</span>`;
}

function pageReports() {
  const d = REPORT_DATA || { revenue: 0, aov: 0, orders: 0, cancelled: 0, conversion: 0, daily: [], byArea: [], topCustomers: [], productsPerf: [], delivered: 0 };

  if (REPORT_TAB === "overview" && !REPORT_DATA) {
    API.reports.summary(REPORT_RANGE).then(r => { REPORT_DATA = r; App.render(); }).catch(() => {});
  }
  if (REPORT_TAB === "area" && !AREA_DATA) {
    API.reports.areaIntelligence().then(r => { AREA_DATA = r; App.render(); }).catch(() => {});
  }
  if (REPORT_TAB === "demand" && (!REPORT_DATA || !CUST_DATA)) {
    if (!REPORT_DATA) API.reports.summary(REPORT_RANGE).then(r => { REPORT_DATA = r; App.render(); }).catch(() => {});
    if (!CUST_DATA) API.reports.customizations().then(r => { CUST_DATA = r; App.render(); }).catch(() => {});
  }
  if (REPORT_TAB === "cook" && !COOK_DATA) {
    API.reports.cookPlan().then(r => { COOK_DATA = r; App.render(); }).catch(() => {});
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "area",     label: "Area Intelligence" },
    { id: "demand",   label: "Food Demand" },
    { id: "cook",     label: "Cook Plan" },
  ];

  return `
    <div class="page-header">
      <div><div class="page-h1">Reports & Analytics</div><div class="page-h1-sub">Business intelligence for DabbaBox</div></div>
      ${REPORT_TAB === "overview" || REPORT_TAB === "demand" ? `<div class="tabs">${[7,30,90,180].map(r => `<div class="tab ${REPORT_RANGE===r?"active":""}" onclick="REPORT_RANGE=${r};REPORT_DATA=null;CUST_DATA=null;App.render()">${r}d</div>`).join("")}</div>` : ""}
    </div>
    <div class="tabs" style="margin-bottom:18px">
      ${tabs.map(t => `<div class="tab ${REPORT_TAB===t.id?"active":""}" onclick="REPORT_TAB='${t.id}';App.render()">${t.label}</div>`).join("")}
    </div>
    ${REPORT_TAB === "overview" ? renderOverviewTab(d) : ""}
    ${REPORT_TAB === "area"     ? renderAreaTab() : ""}
    ${REPORT_TAB === "demand"   ? renderDemandTab(d) : ""}
    ${REPORT_TAB === "cook"     ? renderCookTab() : ""}
  `;
}

/* ══════════════════════════════════════════
   TAB 1 — OVERVIEW
══════════════════════════════════════════ */
function renderOverviewTab(d) {
  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
      ${kpiCard("Revenue", fmtINR(d.revenue), `<span class="muted" style="font-size:11.5px">${d.delivered} delivered</span>`, "chart")}
      ${kpiCard("Avg order value", fmtINR(d.aov), '<span class="muted" style="font-size:11.5px">per order</span>', "trendUp")}
      ${kpiCard("Orders", String(d.orders), `<span class="muted" style="font-size:11.5px">${d.cancelled} cancelled</span>`, "package")}
      ${kpiCard("Lead conversion", d.conversion + "%", '<span class="muted" style="font-size:11.5px">lead → customer</span>', "target")}
    </div>
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card"><div class="card-head"><div class="card-title">Revenue over time</div><div class="card-sub">Delivered orders, last ${REPORT_RANGE}d</div></div><div class="card-pad"><canvas id="repRev" height="90"></canvas></div></div>
      <div class="card"><div class="card-head"><div class="card-title">Revenue by area</div><div class="card-sub">Top 6 localities</div></div><div class="card-pad">${d.byArea.length ? d.byArea.slice(0,6).map(({area,value}) => `<div style="margin-bottom:8px"><div class="between" style="font-size:12.5px;margin-bottom:3px"><span>${esc(area)}</span><span class="num" style="font-weight:600">${fmtINR(value)}</span></div><div class="prog"><div class="bar" style="width:${Math.round(value/d.byArea[0].value*100)}%"></div></div></div>`).join("") : '<div class="muted" style="font-size:13px;padding:8px 0">No data</div>'}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="card"><div class="card-head"><div class="card-title">Top customers</div><div class="card-sub">By revenue, last ${REPORT_RANGE}d</div></div><div class="table-scroll" style="max-height:300px;border:none;border-radius:0"><table class="table"><thead><tr><th>#</th><th>Customer</th><th>Area</th><th>Revenue</th></tr></thead><tbody>${d.topCustomers.length ? d.topCustomers.map((x,i) => `<tr onclick="openCustomerDetail('${x.id}')"><td class="muted">${i+1}</td><td><div class="row"><div class="avatar ${avClass(x.name)}">${initials(x.name)}</div><span style="font-weight:600">${esc(x.name)}</span></div></td><td class="muted">${esc(x.area||"—")}</td><td class="num" style="font-weight:600">${fmtINR(x.value)}</td></tr>`).join("") : `<tr><td colspan="4" class="muted" style="padding:18px;text-align:center">No data yet</td></tr>`}</tbody></table></div></div>
      <div class="card"><div class="card-head"><div class="card-title">Product performance</div><div class="card-sub">Units & revenue, last ${REPORT_RANGE}d</div></div><div class="table-scroll" style="max-height:300px;border:none;border-radius:0"><table class="table"><thead><tr><th>Item</th><th>Units sold</th><th>Revenue</th></tr></thead><tbody>${d.productsPerf.length ? d.productsPerf.map(x => `<tr><td style="font-weight:600">${esc(x.name)}</td><td class="num">${x.qty}</td><td class="num" style="font-weight:600">${fmtINR(x.rev)}</td></tr>`).join("") : `<tr><td colspan="3" class="muted" style="padding:18px;text-align:center">No data yet</td></tr>`}</tbody></table></div></div>
    </div>`;
}

/* ══════════════════════════════════════════
   TAB 2 — AREA INTELLIGENCE
══════════════════════════════════════════ */
function renderAreaTab() {
  if (!AREA_DATA) return `<div class="card"><div style="padding:60px;text-align:center;color:var(--c-muted)">Loading area data…</div></div>`;
  const areas = AREA_DATA;
  if (!areas.length) return `<div class="card"><div class="card-pad muted">No order data available yet.</div></div>`;
  const topOrders = areas[0].orders || 1;
  const topRev = Math.max(...areas.map(a => a.revenue)) || 1;
  const fastest = [...areas].sort((a,b) => b.trend - a.trend)[0];
  const underserved = [...areas].filter(a => a.customers > 1).sort((a,b) => (a.revenue/a.customers) - (b.revenue/b.customers))[0];

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
      ${kpiCard("Areas served", String(areas.length), '<span class="muted" style="font-size:11.5px">unique localities</span>', "mappin")}
      ${kpiCard("Top area", esc(areas[0]?.area||"—"), `<span class="muted" style="font-size:11.5px">${areas[0]?.orders||0} orders</span>`, "zap")}
      ${kpiCard("Fastest growing", esc(fastest?.area||"—"), trendChip(fastest?.trend||0), "trendUp")}
      ${kpiCard("Potential area", esc(underserved?.area||"—"), `<span class="muted" style="font-size:11.5px">${underserved?.customers||0} customers, low AOV</span>`, "target")}
    </div>

    <div style="display:grid;grid-template-columns:3fr 2fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-head"><div class="card-title">Orders by area</div><div class="card-sub">All time</div></div>
        <div class="card-pad"><canvas id="areaOrdersChart" height="160"></canvas></div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">Revenue by area</div><div class="card-sub">All time</div></div>
        <div class="card-pad">
          ${areas.slice(0,7).map(a => `
            <div style="margin-bottom:10px">
              <div class="between" style="font-size:12.5px;margin-bottom:3px">
                <span style="font-weight:600">${esc(a.area)}</span>
                <span class="num" style="font-weight:600">${fmtINR(a.revenue)}</span>
              </div>
              <div class="prog"><div class="bar" style="width:${Math.round(a.revenue/topRev*100)}%"></div></div>
            </div>`).join("")}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><div class="card-title">Area breakdown</div><div class="card-sub">Full intelligence table</div></div>
      <div class="table-scroll" style="border:none;border-radius:0">
        <table class="table">
          <thead><tr><th>Area</th><th>Customers</th><th>Total orders</th><th>Revenue</th><th>Avg order value</th><th>Orders (30d)</th><th>30d trend</th><th>New customers (30d)</th></tr></thead>
          <tbody>
            ${areas.map(a => `<tr>
              <td style="font-weight:600">${esc(a.area)}</td>
              <td class="num">${a.customers}</td>
              <td class="num">${a.orders}</td>
              <td class="num" style="font-weight:600">${fmtINR(a.revenue)}</td>
              <td class="num">${fmtINR(a.aov)}</td>
              <td class="num">${a.orders30}</td>
              <td>${trendChip(a.trend)}</td>
              <td class="num">${a.newCust30 > 0 ? `<span style="color:var(--c-success);font-weight:600">+${a.newCust30}</span>` : "0"}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   TAB 3 — FOOD DEMAND
══════════════════════════════════════════ */
function renderDemandTab(d) {
  if (!REPORT_DATA || !CUST_DATA) return `<div class="card"><div style="padding:60px;text-align:center;color:var(--c-muted)">Loading demand data…</div></div>`;
  const top3 = (d.productsPerf || []).slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const custItems = CUST_DATA.items || [];
  const maxCust = custItems[0]?.count || 1;

  return `
    <!-- Best sellers podium -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px">
      ${top3.map((p, i) => `
        <div class="card card-pad" style="text-align:center;${i===0?"border:2px solid var(--c-brand)":""}">
          <div style="font-size:32px;margin-bottom:4px">${medals[i]}</div>
          <div style="font-weight:700;font-size:15px;margin-bottom:4px">${esc(p.name)}</div>
          <div style="font-size:22px;font-weight:800;color:var(--c-brand)">${p.qty}</div>
          <div class="muted" style="font-size:11.5px">units sold</div>
          <div style="font-weight:600;font-size:13px;margin-top:6px">${fmtINR(p.rev)}</div>
        </div>`).join("")}
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
      <!-- Demand chart -->
      <div class="card">
        <div class="card-head"><div class="card-title">Tiffin demand</div><div class="card-sub">Units ordered, last ${REPORT_RANGE}d</div></div>
        <div class="card-pad"><canvas id="demandChart" height="120"></canvas></div>
      </div>

      <!-- Repeat rate -->
      <div class="card">
        <div class="card-head"><div class="card-title">Order stats</div><div class="card-sub">Engagement metrics</div></div>
        <div class="card-pad">
          <div class="between" style="padding:8px 0;border-bottom:1px solid var(--c-border)">
            <span style="font-size:13px">Total orders (period)</span>
            <span style="font-weight:700">${d.orders}</span>
          </div>
          <div class="between" style="padding:8px 0;border-bottom:1px solid var(--c-border)">
            <span style="font-size:13px">Delivered</span>
            <span style="font-weight:700;color:var(--c-success)">${d.delivered}</span>
          </div>
          <div class="between" style="padding:8px 0;border-bottom:1px solid var(--c-border)">
            <span style="font-size:13px">Cancelled</span>
            <span style="font-weight:700;color:var(--c-danger)">${d.cancelled}</span>
          </div>
          <div class="between" style="padding:8px 0">
            <span style="font-size:13px">Delivery rate</span>
            <span style="font-weight:700;color:var(--c-brand)">${d.orders > 0 ? Math.round(d.delivered/d.orders*100) : 0}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Full product performance table -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div class="card">
        <div class="card-head"><div class="card-title">All items — demand ranking</div></div>
        <div class="table-scroll" style="max-height:340px;border:none;border-radius:0">
          <table class="table">
            <thead><tr><th>Rank</th><th>Item</th><th>Units</th><th>Revenue</th></tr></thead>
            <tbody>
              ${(d.productsPerf||[]).map((p,i) => `<tr>
                <td class="muted">#${i+1}</td>
                <td style="font-weight:600">${esc(p.name)}</td>
                <td class="num" style="font-weight:600;color:var(--c-brand)">${p.qty}</td>
                <td class="num">${fmtINR(p.rev)}</td>
              </tr>`).join("") || `<tr><td colspan="4" class="muted" style="padding:18px;text-align:center">No data yet</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Customization analytics -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Plate customizations</div>
            <div class="card-sub">${CUST_DATA.ordersWithCustomizations} of ${CUST_DATA.total} orders (${CUST_DATA.pct}%) have customizations</div>
          </div>
        </div>
        <div class="card-pad">
          ${custItems.length ? `
            <div style="margin-bottom:12px">
              <div class="prog" style="height:8px;border-radius:4px;background:var(--c-surface-2)">
                <div style="width:${CUST_DATA.pct}%;height:100%;background:var(--c-brand);border-radius:4px"></div>
              </div>
              <div class="muted" style="font-size:11.5px;margin-top:4px">${CUST_DATA.pct}% of orders have at least one customization</div>
            </div>
            ${custItems.map(c => `
              <div style="margin-bottom:8px">
                <div class="between" style="font-size:12.5px;margin-bottom:3px">
                  <span style="font-weight:500">${esc(c.name)}</span>
                  <span class="num" style="font-weight:600">${c.count} <span class="muted">(${c.pct}%)</span></span>
                </div>
                <div class="prog"><div class="bar" style="width:${Math.round(c.count/maxCust*100)}%"></div></div>
              </div>`).join("")}
          ` : '<div class="muted" style="font-size:13px">No customization data yet. Customizations are recorded when creating orders.</div>'}
        </div>
      </div>
    </div>`;
}

/* ══════════════════════════════════════════
   TAB 4 — COOK PLAN
══════════════════════════════════════════ */
function renderCookTab() {
  if (!COOK_DATA) return `<div class="card"><div style="padding:60px;text-align:center;color:var(--c-muted)">Loading cook plan…</div></div>`;
  const c = COOK_DATA;
  const today = new Date(c.date);
  const dayLabel = today.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long" });

  return `
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">

      <!-- Main cook list -->
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Kitchen preparation list</div>
            <div class="card-sub">${dayLabel} • ${c.totalTiffins} tiffins to prepare</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="printCookPlan()">${ic("printer", 13)}<span>Print</span></button>
        </div>
        <div class="card-pad" id="cookPlanBody">
          ${c.items.length ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-bottom:16px">
              ${c.items.map(it => `
                <div style="background:var(--c-surface-2);border-radius:12px;padding:16px;text-align:center;border:1px solid var(--c-border)">
                  <div style="font-size:36px;font-weight:900;color:var(--c-brand);line-height:1">${it.qty}</div>
                  <div style="font-size:13px;font-weight:600;margin-top:6px">${esc(it.name)}</div>
                  <div class="muted" style="font-size:11px">portions</div>
                </div>`).join("")}
            </div>
            <div style="background:var(--c-accent-tint);border:1px solid var(--c-accent);border-radius:10px;padding:14px">
              <div style="font-weight:600;font-size:13px;margin-bottom:2px">Grand Total</div>
              <div style="font-size:28px;font-weight:800;color:var(--c-brand)">${c.totalTiffins} <span style="font-size:14px;font-weight:400;color:var(--c-muted)">tiffins</span></div>
              <div class="muted" style="font-size:12px;margin-top:4px">From ${c.activeOrderCount} active orders + ${c.subCount} subscriptions</div>
            </div>
          ` : `<div class="muted" style="padding:30px;text-align:center">No pending orders for today. All caught up!</div>`}
        </div>
      </div>

      <!-- Side panel: customizations + order list -->
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Special instructions summary -->
        <div class="card">
          <div class="card-head"><div class="card-title">Special instructions</div><div class="card-sub">Customization count</div></div>
          <div class="card-pad">
            ${c.customizations.length ? c.customizations.map(ct => `
              <div class="between" style="padding:6px 0;border-bottom:1px solid var(--c-border);font-size:13px">
                <span>${esc(ct.name)}</span>
                <span class="badge badge-accent">${ct.count}×</span>
              </div>`).join("") :
              '<div class="muted" style="font-size:12.5px">No special instructions for today.</div>'}
          </div>
        </div>

        <!-- Order list for today -->
        <div class="card">
          <div class="card-head"><div class="card-title">Today's orders</div><span class="chip">${c.orderDetails.length}</span></div>
          <div style="max-height:280px;overflow-y:auto">
            ${c.orderDetails.length ? c.orderDetails.map(o => `
              <div style="padding:10px 14px;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="openOrderDetail('${o.id}')">
                <div class="between">
                  <div style="font-weight:600;font-size:13px">${esc(o.custName||"—")}</div>
                  <span class="badge ${ORDER_BADGE[o.status]||"badge-neutral"}">${ORDER_LABEL[o.status]||o.status}</span>
                </div>
                <div class="muted" style="font-size:11.5px">${esc(o.custArea||"")}${o.customizations.length ? " • " + o.customizations.map(esc).join(", ") : ""}</div>
                ${o.custPrefs && o.custPrefs.dietaryType ? `<div style="margin-top:3px">${dietBadge(o.custPrefs)}</div>` : ""}
              </div>`).join("") :
              '<div class="muted" style="padding:16px;font-size:13px">No active orders.</div>'}
          </div>
        </div>

      </div>
    </div>`;
}

/* ── Chart.js rendering ── */
pageReports.after = function () {
  const cs = getComputedStyle(document.documentElement);
  const brand = cs.getPropertyValue("--c-brand").trim() || "#4a7c59";
  const accent = cs.getPropertyValue("--c-accent").trim() || "#f9a620";
  const ink2 = cs.getPropertyValue("--c-muted").trim();
  const grid = cs.getPropertyValue("--c-border").trim();

  if (REPORT_TAB === "overview" && REPORT_DATA) {
    const labels = REPORT_DATA.daily.map(x => new Date(x.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }));
    const vals = REPORT_DATA.daily.map(x => x.value);
    if (window._chRepRev) window._chRepRev.destroy();
    const ctx = document.getElementById("repRev"); if (!ctx) return;
    window._chRepRev = new Chart(ctx, { type: "bar", data: { labels, datasets: [{ label: "Revenue", data: vals, backgroundColor: brand, borderRadius: 4, maxBarThickness: 18 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: ink2, font: { size: 10 }, maxRotation: 0, autoSkip: true } }, y: { grid: { color: grid }, ticks: { color: ink2, font: { size: 10 }, callback: v => "₹" + (v >= 1000 ? (v/1000).toFixed(1)+"k" : v) } } } } });
  }

  if (REPORT_TAB === "area" && AREA_DATA && AREA_DATA.length) {
    const top8 = AREA_DATA.slice(0, 8);
    if (window._chArea) window._chArea.destroy();
    const ctx = document.getElementById("areaOrdersChart"); if (!ctx) return;
    window._chArea = new Chart(ctx, { type: "bar", data: { labels: top8.map(a => a.area), datasets: [{ label: "Orders", data: top8.map(a => a.orders), backgroundColor: brand, borderRadius: 6, maxBarThickness: 32 }, { label: "Orders (30d)", data: top8.map(a => a.orders30), backgroundColor: accent + "cc", borderRadius: 6, maxBarThickness: 32 }] }, options: { plugins: { legend: { position: "bottom", labels: { boxWidth: 10, color: ink2, font: { size: 11 } } } }, scales: { x: { grid: { display: false }, ticks: { color: ink2, font: { size: 11 } } }, y: { grid: { color: grid }, ticks: { color: ink2, font: { size: 10 } } } } } });
  }

  if (REPORT_TAB === "demand" && REPORT_DATA) {
    const prods = (REPORT_DATA.productsPerf || []).slice(0, 7);
    if (window._chDemand) window._chDemand.destroy();
    const ctx = document.getElementById("demandChart"); if (!ctx) return;
    window._chDemand = new Chart(ctx, { type: "bar", data: { labels: prods.map(p => p.name), datasets: [{ label: "Units", data: prods.map(p => p.qty), backgroundColor: [brand, accent, "#c97070", "#4a6fa5", "#7a5b8e", "#059669", "#d97706"].slice(0, prods.length), borderRadius: 6, maxBarThickness: 36 }] }, options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { grid: { color: grid }, ticks: { color: ink2, font: { size: 10 } } }, y: { grid: { display: false }, ticks: { color: ink2, font: { size: 11 } } } } } });
  }
};

/* ── Print cook plan ── */
function printCookPlan() {
  if (!COOK_DATA) return;
  const c = COOK_DATA;
  const today = new Date(c.date);
  const dayLabel = today.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const html = `<!doctype html><html><head><title>Cook Plan — ${c.date}</title><style>body{font-family:Inter,sans-serif;padding:30px;color:#111;max-width:700px;margin:auto}h1{font-size:22px;margin-bottom:4px}h2{font-size:15px;font-weight:600;margin:20px 0 10px;border-bottom:1px solid #ddd;padding-bottom:4px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}.box{border:2px solid #ddd;border-radius:10px;padding:16px;text-align:center}.qty{font-size:40px;font-weight:900;color:#4a7c59}.name{font-size:13px;font-weight:600;margin-top:4px}.custom-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:13px}.badge{background:#fde9c1;color:#b45309;border-radius:4px;padding:2px 8px;font-weight:600}@media print{body{padding:0}}</style></head><body>
    <h1>DabbaBox Kitchen Plan</h1>
    <div style="color:#666;font-size:13px;margin-bottom:20px">${dayLabel} &nbsp;|&nbsp; ${c.totalTiffins} total tiffins &nbsp;|&nbsp; ${c.activeOrderCount} orders + ${c.subCount} subscriptions</div>
    <h2>Items to Prepare</h2>
    <div class="grid">${c.items.map(it => `<div class="box"><div class="qty">${it.qty}</div><div class="name">${it.name}</div></div>`).join("")}</div>
    ${c.customizations.length ? `<h2>Special Instructions</h2>${c.customizations.map(ct => `<div class="custom-row"><span>${ct.name}</span><span class="badge">${ct.count}×</span></div>`).join("")}` : ""}
    <div style="margin-top:30px;font-size:11px;color:#999;text-align:center">Printed from DabbaBox CRM</div>
  </body></html>`;
  const win = window.open("", "_blank", "width=750,height=900");
  win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300);
}
