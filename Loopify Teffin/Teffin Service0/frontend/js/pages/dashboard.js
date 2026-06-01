function pageDashboard() {
  const now = Date.now(); const dayMs = 86400000;
  const totalRev = State.orders.filter(o => o.status === "delivered").reduce((s, o) => s + o.total, 0);
  const rev30 = State.orders.filter(o => o.status === "delivered" && o.createdAt > now - 30 * dayMs).reduce((s, o) => s + o.total, 0);
  const rev60to30 = State.orders.filter(o => o.status === "delivered" && o.createdAt > now - 60 * dayMs && o.createdAt <= now - 30 * dayMs).reduce((s, o) => s + o.total, 0);
  const trend = rev60to30 > 0 ? Math.round((rev30 - rev60to30) / rev60to30 * 100) : (rev30 > 0 ? 100 : 0);
  const pending = State.orders.filter(o => ["confirmed","preparing","out_for_delivery"].includes(o.status)).length;
  const activeSubs = State.subscriptions.filter(s => s.status === "active").length;
  const lowStock = State.products.filter(p => p.stock <= p.lowStockAt).length;
  const today = todayISO();
  const todaysFollowups = State.leads.filter(l => l.followUp && l.followUp <= today && !["converted","lost"].includes(l.stage));
  const todayDeliveries = State.orders.filter(o => o.status === "out_for_delivery").slice(0, 4);

  return `
    <div class="kpi-grid">
      ${kpiCard("Total revenue", fmtINR(totalRev), trend !== 0 ? `<span class="kpi-trend ${trend > 0 ? "up" : "down"}">${ic(trend > 0 ? "trendUp" : "trendDown", 12)} ${Math.abs(trend)}% vs prev 30d</span>` : '<span class="muted" style="font-size:11.5px">30-day window</span>', "chart")}
      ${kpiCard("Revenue (30d)", fmtINR(rev30), `<span class="muted" style="font-size:11.5px">${State.orders.filter(o => o.status === "delivered" && o.createdAt > now - 30 * dayMs).length} delivered orders</span>`, "zap")}
      ${kpiCard("Customers", String(State.customers.length), `<span class="muted" style="font-size:11.5px">+${State.customers.filter(c => c.createdAt > now - 30 * dayMs).length} this month</span>`, "users")}
      ${kpiCard("Active subscriptions", String(activeSubs), '<span class="muted" style="font-size:11.5px">recurring revenue</span>', "repeat")}
      ${kpiCard("Pending deliveries", String(pending), '<span class="muted" style="font-size:11.5px">in progress</span>', "truck")}
      ${kpiCard("Low-stock items", String(lowStock), lowStock > 0 ? '<span class="kpi-trend down">' + ic("warn", 12) + " needs attention</span>" : '<span class="kpi-trend up">' + ic("check", 12) + " all good</span>", "package")}
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Revenue trend</div><div class="card-sub">Delivered orders, last 30 days</div></div><div class="tabs"><div class="tab active">Last 30d</div></div></div>
        <div class="card-pad"><canvas id="chartRev" height="90"></canvas></div>
      </div>
      <div class="card"><div class="card-head"><div class="card-title">Order status</div></div><div class="card-pad"><canvas id="chartStatus" height="170"></canvas></div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card"><div class="card-head"><div class="card-title">Top customers</div><div class="card-sub">By lifetime spend</div></div><div id="topCust"></div></div>
      <div class="card"><div class="card-head"><div class="card-title">Popular tiffins</div><div class="card-sub">Units sold (all time)</div></div><div class="card-pad"><canvas id="chartProd" height="170"></canvas></div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card"><div class="card-head"><div class="card-title">Today's deliveries</div><span class="chip">${todayDeliveries.length}</span></div>
        <div class="card-pad" style="display:flex;flex-direction:column;gap:8px">
          ${todayDeliveries.length ? todayDeliveries.map(o => { const cu = State.customers.find(c => c.id === o.customerId); const p = State.partners.find(p => p.id === o.partnerId); return `<div class="between" style="cursor:pointer" onclick="openOrderDetail('${o.id}')"><div class="row"><div class="avatar ${avClass(cu ? cu.name : "")}">${initials(cu ? cu.name : "?")}</div><div><div style="font-weight:600;font-size:13px">${esc(cu ? cu.name : "—")}</div><div class="muted" style="font-size:11.5px">${esc(p ? p.name : "unassigned")} • #${o.id.slice(-6).toUpperCase()}</div></div></div><div style="font-weight:700;font-size:13px">${fmtINR(o.total)}</div></div>`; }).join("") : '<div class="muted" style="font-size:13px;padding:8px 0">No deliveries out today.</div>'}
        </div>
      </div>
      <div class="card"><div class="card-head"><div class="card-title">Follow-ups due</div><span class="chip">${todaysFollowups.length}</span></div>
        <div class="card-pad" style="display:flex;flex-direction:column;gap:8px">
          ${todaysFollowups.length ? todaysFollowups.slice(0, 4).map(l => `<div class="between" style="cursor:pointer" onclick="openLeadForm('${l.id}')"><div class="row"><div class="avatar ${avClass(l.name)}">${initials(l.name)}</div><div><div style="font-weight:600;font-size:13px">${esc(l.name)}</div><div class="muted" style="font-size:11.5px">${esc(l.source)} • ${fmtDate(l.followUp)}</div></div></div><span class="badge ${LEAD_STAGES.find(s => s.id === l.stage)?.badge}">${LEAD_STAGES.find(s => s.id === l.stage)?.label}</span></div>`).join("") : '<div class="muted" style="font-size:13px;padding:8px 0">No follow-ups due. ✨</div>'}
        </div>
      </div>
      <div class="card"><div class="card-head"><div class="card-title">Low-stock alerts</div><span class="chip">${lowStock}</span></div>
        <div class="card-pad" style="display:flex;flex-direction:column;gap:8px">
          ${State.products.filter(p => p.stock <= p.lowStockAt).length ? State.products.filter(p => p.stock <= p.lowStockAt).slice(0, 4).map(p => `<div class="between" style="cursor:pointer" onclick="openProductForm('${p.id}')"><div class="row"><div style="font-size:22px">${esc(p.emoji || "🍱")}</div><div><div style="font-weight:600;font-size:13px">${esc(p.name)}</div><div class="muted" style="font-size:11.5px">${esc(p.category || "")}</div></div></div><span class="badge badge-danger">${p.stock} left</span></div>`).join("") : '<div class="muted" style="font-size:13px;padding:8px 0">All items stocked. ✨</div>'}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-head"><div><div class="card-title">Area Pulse</div><div class="card-sub">Orders by locality — last 30 days</div></div><button class="btn btn-ghost btn-sm" onclick="REPORT_TAB='area';App.go('reports')">${ic("arrowRight", 12)}<span>Full view</span></button></div>
        <div class="card-pad" id="areaPulse"></div>
      </div>
      <div class="card"><div class="card-head"><div class="card-title">Recent activity</div></div><div class="card-pad" id="activityFeed"></div></div>
    </div>
  `;
}

pageDashboard.after = function () {
  const dayMs = 86400000;
  // Revenue chart
  const days = [], vals = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const next = d.getTime() + 86400000;
    const sum = State.orders.filter(o => o.status === "delivered" && o.createdAt >= d.getTime() && o.createdAt < next).reduce((s, o) => s + o.total, 0);
    days.push(d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })); vals.push(sum);
  }
  const cs = getComputedStyle(document.documentElement);
  const brand = cs.getPropertyValue("--c-brand").trim() || "#4a7c59";
  const ink2 = cs.getPropertyValue("--c-muted").trim();
  const grid = cs.getPropertyValue("--c-border").trim();
  if (window._chRev) window._chRev.destroy();
  window._chRev = new Chart(document.getElementById("chartRev"), { type: "line", data: { labels: days, datasets: [{ label: "Revenue", data: vals, borderColor: brand, backgroundColor: brand + "22", fill: true, tension: .35, pointRadius: 0, borderWidth: 2, pointHoverRadius: 4 }] }, options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: ink2, font: { size: 10 } } }, y: { grid: { color: grid }, ticks: { color: ink2, font: { size: 10 }, callback: v => "₹" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v) } } } } });

  // Status doughnut
  const counts = {}; ORDER_STAGES.forEach(s => counts[s] = 0);
  State.orders.forEach(o => counts[o.status] = (counts[o.status] || 0) + 1);
  const colors = { pending: "#f9a620", confirmed: "#4a6fa5", preparing: "#7a5b8e", out_for_delivery: "#c97070", delivered: "#4a7c59", cancelled: "#b7472a" };
  if (window._chStatus) window._chStatus.destroy();
  window._chStatus = new Chart(document.getElementById("chartStatus"), { type: "doughnut", data: { labels: ORDER_STAGES.map(s => ORDER_LABEL[s]), datasets: [{ data: ORDER_STAGES.map(s => counts[s]), backgroundColor: ORDER_STAGES.map(s => colors[s]), borderColor: cs.getPropertyValue("--c-surface").trim(), borderWidth: 2 }] }, options: { cutout: "68%", plugins: { legend: { position: "bottom", labels: { boxWidth: 9, color: ink2, font: { size: 11 } } } } } });

  // Top customers
  const map = {};
  State.orders.filter(o => o.status === "delivered").forEach(o => map[o.customerId] = (map[o.customerId] || 0) + o.total);
  const top = Object.entries(map).map(([id, v]) => ({ c: State.customers.find(x => x.id === id), v })).filter(x => x.c).sort((a, b) => b.v - a.v).slice(0, 5);
  document.getElementById("topCust").innerHTML = top.length ? top.map((x, i) => `<div class="between" style="padding:10px 16px;border-bottom:1px solid var(--c-border);cursor:pointer" onclick="openCustomerDetail('${x.c.id}')"><div class="row"><div class="avatar ${avClass(x.c.name)}">${initials(x.c.name)}</div><div><div style="font-weight:600;font-size:13px">${esc(x.c.name)}</div><div class="muted mono" style="font-size:11.5px">${esc(x.c.phone || "")}</div></div></div><div style="text-align:right"><div style="font-weight:700;font-size:14px" class="num">${fmtINR(x.v)}</div><div class="muted" style="font-size:11px">${State.orders.filter(o => o.customerId === x.c.id && o.status === "delivered").length} orders</div></div></div>`).join("") : `<div class="empty" style="padding:30px"><div class="empty-sub">No revenue data yet.</div></div>`;

  // Products bar
  const pmap = {};
  State.orders.forEach(o => (o.items || []).forEach(it => pmap[it.name] = (pmap[it.name] || 0) + it.qty));
  const arr = Object.entries(pmap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const accent = cs.getPropertyValue("--c-accent").trim() || "#f9a620";
  if (window._chProd) window._chProd.destroy();
  window._chProd = new Chart(document.getElementById("chartProd"), { type: "bar", data: { labels: arr.map(x => x[0]), datasets: [{ label: "Units", data: arr.map(x => x[1]), backgroundColor: accent, borderRadius: 6, maxBarThickness: 24 }] }, options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { grid: { color: grid }, ticks: { color: ink2, font: { size: 10 } } }, y: { grid: { display: false }, ticks: { color: ink2, font: { size: 11 } } } } } });

  // Area Pulse
  const now30 = Date.now() - 30 * dayMs; const now60to30 = Date.now() - 60 * dayMs;
  const areaMap = {};
  State.orders.filter(o => o.createdAt > now60to30).forEach(o => {
    const cu = State.customers.find(c => c.id === o.customerId); const area = (cu && cu.area) || "Unknown";
    if (!areaMap[area]) areaMap[area] = { r: 0, p: 0 };
    if (o.createdAt > now30) areaMap[area].r++;
    else areaMap[area].p++;
  });
  const areaArr = Object.entries(areaMap).map(([name, v]) => ({ name, recent: v.r, prev: v.p, trend: v.p > 0 ? Math.round((v.r - v.p) / v.p * 100) : (v.r > 0 ? 100 : 0) })).sort((a, b) => b.recent - a.recent).slice(0, 6);
  const maxArea = areaArr.reduce((m, x) => Math.max(m, x.recent), 1);
  const apEl = document.getElementById("areaPulse");
  if (apEl) apEl.innerHTML = areaArr.length ? areaArr.map(a => `<div style="margin-bottom:10px"><div class="between" style="margin-bottom:3px"><span style="font-weight:600;font-size:13px">${esc(a.name)}</span><div class="row-tight"><span class="num" style="font-size:12px;font-weight:700">${a.recent}</span><span style="font-size:11px;padding:1px 6px;border-radius:99px;font-weight:600;margin-left:4px;${a.trend > 0 ? "background:#e8f5e9;color:#2e7d32" : a.trend < 0 ? "background:#fce8e6;color:#c62828" : "background:var(--c-surface-2);color:var(--c-muted)"}">${a.trend > 0 ? "+" : ""}${a.trend}%</span></div></div><div style="height:6px;background:var(--c-surface-2);border-radius:3px"><div style="height:100%;width:${Math.round(a.recent / maxArea * 100)}%;background:var(--c-brand);border-radius:3px;transition:width .4s"></div></div></div>`).join("") : '<div class="muted" style="font-size:13px;padding:8px 0">No area data yet.</div>';

  // Activity feed
  const af = document.getElementById("activityFeed");
  if (!State.activity.length) { af.innerHTML = '<div class="muted" style="padding:8px 0;font-size:13px">No activity yet.</div>'; return; }
  af.innerHTML = State.activity.slice(0, 10).map(a => `<div class="row" style="padding:6px 0;border-bottom:1px solid var(--c-border);font-size:13px"><div class="muted mono" style="font-size:11.5px;min-width:120px">${fmtTime(a.at)}</div><div>${esc(a.text)}</div></div>`).join("");
};
