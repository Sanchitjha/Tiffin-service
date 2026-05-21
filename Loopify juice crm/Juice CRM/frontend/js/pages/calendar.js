let CAL_MONTH = { y: new Date().getFullYear(), m: new Date().getMonth() };

function pageCalendar() {
  const { y, m } = CAL_MONTH;
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const startDay = first.getDay(), totalDays = last.getDate();
  const today = todayISO();
  const cells = []; const prevLast = new Date(y, m, 0).getDate();
  for (let i = startDay - 1; i >= 0; i--) cells.push({ d: prevLast - i, muted: true, iso: "" });
  for (let d = 1; d <= totalDays; d++) { const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; cells.push({ d, iso, muted: false }); }
  while (cells.length % 7 !== 0) cells.push({ d: cells.length - totalDays - startDay + 1, muted: true, iso: "" });
  const monthName = first.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  function eventsFor(iso) {
    if (!iso) return [];
    const evs = [];
    State.orders.filter(o => isoDate(o.createdAt) === iso).forEach(o => { const cu = State.customers.find(c => c.id === o.customerId); evs.push({ type: "order", label: `#${o.id.slice(-6).toUpperCase()} ${cu ? cu.name : ""}`, id: o.id }); });
    State.subscriptions.filter(s => s.status === "active" && s.nextDelivery === iso).forEach(s => evs.push({ type: "sub", label: `🔁 ${s.name}`, id: s.id }));
    State.leads.filter(l => l.followUp === iso && !["converted","lost"].includes(l.stage)).forEach(l => evs.push({ type: "followup", label: `📞 ${l.name}`, id: l.id }));
    return evs;
  }
  return `
    <div class="page-header"><div><div class="page-h1">Calendar</div><div class="page-h1-sub">Orders, subscriptions & follow-ups</div></div>
      <div class="row-tight">
        <button class="icon-btn" onclick="calPrev()">${ic("chevronLeft", 16)}</button>
        <div style="font-weight:600;min-width:160px;text-align:center">${esc(monthName)}</div>
        <button class="icon-btn" onclick="calNext()">${ic("chevronRight", 16)}</button>
        <button class="btn btn-secondary btn-sm" onclick="CAL_MONTH={y:new Date().getFullYear(),m:new Date().getMonth()};App.render()">Today</button>
      </div>
    </div>
    <div class="card card-pad">
      <div class="cal-grid">${days.map(d => `<div class="cal-head">${d}</div>`).join("")}</div>
      <div class="cal-grid" style="margin-top:6px">
        ${cells.map(c => { const evs = eventsFor(c.iso); const isToday = c.iso === today; return `<div class="cal-day ${c.muted ? "muted" : ""} ${isToday ? "today" : ""}">
          <div class="cal-num">${c.d}</div>
          ${evs.slice(0, 3).map(e => `<div class="cal-event ${e.type === "order" ? "delivery" : e.type === "sub" ? "sub" : "followup"}" title="${esc(e.label)}" onclick="${e.type === "order" ? `openOrderDetail('${e.id}')` : e.type === "sub" ? `openSubForm('${e.id}')` : `openLeadForm('${e.id}')`}">${esc(e.label)}</div>`).join("")}
          ${evs.length > 3 ? `<div class="muted" style="font-size:10.5px">+${evs.length - 3} more</div>` : ""}
        </div>`; }).join("")}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px">
      <div class="card card-pad"><div class="row-tight"><span class="cal-event delivery" style="font-size:11px">Orders</span><span class="muted" style="font-size:12px">Order created</span></div></div>
      <div class="card card-pad"><div class="row-tight"><span class="cal-event sub" style="font-size:11px">Subscriptions</span><span class="muted" style="font-size:12px">Subscription delivery</span></div></div>
      <div class="card card-pad"><div class="row-tight"><span class="cal-event followup" style="font-size:11px">Follow-ups</span><span class="muted" style="font-size:12px">Lead due</span></div></div>
    </div>`;
}
function calPrev() { if (CAL_MONTH.m === 0) { CAL_MONTH.m = 11; CAL_MONTH.y--; } else CAL_MONTH.m--; App.render(); }
function calNext() { if (CAL_MONTH.m === 11) { CAL_MONTH.m = 0; CAL_MONTH.y++; } else CAL_MONTH.m++; App.render(); }
