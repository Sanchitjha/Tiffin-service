const express = require("express");
const router = express.Router();
const { db, json } = require("../db");
const { requireAuth } = require("../auth");

router.use(requireAuth);

router.get("/summary", (req, res) => {
  const range = parseInt(req.query.range) || 30;
  const since = Date.now() - range * 86400000;
  const orders = db.prepare("SELECT * FROM orders WHERE created_at >= ?").all(since);
  const delivered = orders.filter(o => o.status === "delivered");
  const revenue = delivered.reduce((s, o) => s + o.total, 0);
  const customers = db.prepare("SELECT * FROM customers").all();
  const leads = db.prepare("SELECT * FROM leads").all();
  const products = db.prepare("SELECT * FROM products").all();
  const subs = db.prepare("SELECT * FROM subscriptions").all();
  const aov = delivered.length ? Math.round(revenue / delivered.length) : 0;
  const conversion = leads.length ? Math.round(leads.filter(l => l.stage === "converted").length / leads.length * 100) : 0;

  // by area
  const byArea = {};
  customers.forEach(c => {
    const list = orders.filter(o => o.customer_id === c.id && o.status === "delivered");
    const v = list.reduce((s, o) => s + o.total, 0);
    if (v) byArea[c.area || "—"] = (byArea[c.area || "—"] || 0) + v;
  });

  // top customers
  const byCust = {};
  delivered.forEach(o => byCust[o.customer_id] = (byCust[o.customer_id] || 0) + o.total);
  const topCust = Object.entries(byCust).map(([id, v]) => {
    const c = customers.find(x => x.id === id);
    return c && { id, name: c.name, area: c.area, value: v };
  }).filter(Boolean).sort((a, b) => b.value - a.value).slice(0, 10);

  // product perf
  const byProd = {};
  orders.forEach(o => {
    (json.parse(o.items, []) || []).forEach(i => {
      byProd[i.name] = byProd[i.name] || { qty: 0, rev: 0 };
      byProd[i.name].qty += i.qty;
      byProd[i.name].rev += i.qty * i.price;
    });
  });
  const products_perf = Object.entries(byProd).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.rev - a.rev).slice(0, 10);

  // daily revenue series
  const daily = [];
  const today0 = new Date(); today0.setHours(0,0,0,0);
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(today0); d.setDate(d.getDate() - i);
    const start = d.getTime(); const end = start + 86400000;
    const sum = delivered.filter(o => o.created_at >= start && o.created_at < end).reduce((s, o) => s + o.total, 0);
    daily.push({ date: d.toISOString().slice(0,10), value: sum });
  }

  res.json({
    range, revenue, aov, conversion,
    orders: orders.length,
    cancelled: orders.filter(o => o.status === "cancelled").length,
    delivered: delivered.length,
    customers: customers.length,
    activeSubs: subs.filter(s => s.status === "active").length,
    lowStock: products.filter(p => p.stock <= p.low_stock_at).length,
    byArea: Object.entries(byArea).map(([area, value]) => ({ area, value })).sort((a, b) => b.value - a.value),
    topCustomers: topCust,
    productsPerf: products_perf,
    daily,
  });
});

router.get("/dashboard", (req, res) => {
  const now = Date.now();
  const orders = db.prepare("SELECT * FROM orders").all();
  const last30 = orders.filter(o => o.status === "delivered" && o.created_at > now - 30 * 86400000);
  const last60to30 = orders.filter(o => o.status === "delivered" && o.created_at > now - 60 * 86400000 && o.created_at <= now - 30 * 86400000);
  const rev30 = last30.reduce((s, o) => s + o.total, 0);
  const rev60to30 = last60to30.reduce((s, o) => s + o.total, 0);
  const trend = rev60to30 > 0 ? Math.round((rev30 - rev60to30) / rev60to30 * 100) : (rev30 > 0 ? 100 : 0);
  const totalRev = orders.filter(o => o.status === "delivered").reduce((s, o) => s + o.total, 0);

  // status counts
  const statusCounts = {};
  ["pending","confirmed","preparing","out_for_delivery","delivered","cancelled"].forEach(s => statusCounts[s] = 0);
  orders.forEach(o => statusCounts[o.status] = (statusCounts[o.status] || 0) + 1);

  // daily 30d
  const daily = [];
  const today0 = new Date(); today0.setHours(0,0,0,0);
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today0); d.setDate(d.getDate() - i);
    const start = d.getTime(); const end = start + 86400000;
    const sum = orders.filter(o => o.status === "delivered" && o.created_at >= start && o.created_at < end).reduce((s, o) => s + o.total, 0);
    daily.push({ date: d.toISOString().slice(0,10), value: sum });
  }

  // top customers
  const byCust = {};
  orders.filter(o => o.status === "delivered").forEach(o => byCust[o.customer_id] = (byCust[o.customer_id] || 0) + o.total);
  const customers = db.prepare("SELECT * FROM customers").all();
  const top = Object.entries(byCust).map(([id, v]) => {
    const c = customers.find(x => x.id === id);
    return c && { id, name: c.name, phone: c.phone, value: v, orders: orders.filter(o => o.customer_id === id && o.status === "delivered").length };
  }).filter(Boolean).sort((a,b)=>b.value-a.value).slice(0,5);

  // popular products
  const byProd = {};
  orders.forEach(o => (json.parse(o.items, []) || []).forEach(i => byProd[i.name] = (byProd[i.name] || 0) + i.qty));
  const popular = Object.entries(byProd).map(([name, qty]) => ({ name, qty })).sort((a,b)=>b.qty-a.qty).slice(0,6);

  res.json({
    totalRevenue: totalRev,
    revenue30: rev30,
    trend,
    customers: customers.length,
    activeSubs: db.prepare("SELECT COUNT(*) c FROM subscriptions WHERE status='active'").get().c,
    pendingDeliveries: orders.filter(o => ["confirmed","preparing","out_for_delivery"].includes(o.status)).length,
    lowStock: db.prepare("SELECT COUNT(*) c FROM products WHERE stock <= low_stock_at").get().c,
    statusCounts, daily, top, popular,
  });
});

router.get("/activity", (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json(db.prepare("SELECT * FROM activity ORDER BY at DESC LIMIT ?").all(limit));
});

/* ---- Area Intelligence ---- */
router.get("/area-intelligence", (req, res) => {
  const now = Date.now();
  const range30 = now - 30 * 86400000;
  const range60 = now - 60 * 86400000;
  const orders = db.prepare("SELECT * FROM orders").all();
  const customers = db.prepare("SELECT * FROM customers").all();

  const areaMap = {};
  customers.forEach(c => {
    const area = c.area || "Unknown";
    if (!areaMap[area]) areaMap[area] = { area, customers: 0, orders: 0, revenue: 0, orders30: 0, revenue30: 0, orders60to30: 0, newCust30: 0 };
    areaMap[area].customers++;
    if (c.created_at >= range30) areaMap[area].newCust30++;
    orders.filter(o => o.customer_id === c.id).forEach(o => {
      areaMap[area].orders++;
      if (o.status === "delivered") {
        areaMap[area].revenue += o.total;
        if (o.created_at >= range30) { areaMap[area].orders30++; areaMap[area].revenue30 += o.total; }
        else if (o.created_at >= range60) areaMap[area].orders60to30++;
      }
    });
  });

  const areas = Object.values(areaMap).map(a => ({
    ...a,
    aov: a.orders > 0 ? Math.round(a.revenue / a.orders) : 0,
    trend: a.orders60to30 > 0 ? Math.round((a.orders30 - a.orders60to30) / a.orders60to30 * 100) : (a.orders30 > 0 ? 100 : 0),
  })).sort((a, b) => b.orders - a.orders);

  res.json(areas);
});

/* ---- Cook Plan (today's pending + confirmed orders + active subs) ---- */
router.get("/cook-plan", (req, res) => {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayISO = today.toISOString().slice(0,10);
  const activeOrders = db.prepare("SELECT o.*, c.name as cust_name, c.area as cust_area, c.preferences as cust_prefs FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.status IN ('pending','confirmed','preparing')").all();
  const activeSubs = db.prepare("SELECT s.*, c.name as cust_name FROM subscriptions s LEFT JOIN customers c ON c.id = s.customer_id WHERE s.status = 'active' AND (s.next_delivery IS NULL OR s.next_delivery <= ?)").all(todayISO);

  const itemPlan = {};
  const custPlan = {};
  let totalTiffins = 0;

  function tally(itemsStr, customizationsStr) {
    const items = json.parse(itemsStr, []);
    const custs = json.parse(customizationsStr || "[]", []);
    items.forEach(it => {
      if (!itemPlan[it.name]) itemPlan[it.name] = { name: it.name, qty: 0 };
      itemPlan[it.name].qty += (it.qty || 1);
      totalTiffins += (it.qty || 1);
    });
    custs.forEach(c => { custPlan[c] = (custPlan[c] || 0) + 1; });
  }

  activeOrders.forEach(o => tally(o.items, o.customizations));
  activeSubs.forEach(s => tally(s.items, "[]"));

  const orderDetails = activeOrders.map(o => ({
    id: o.id,
    custName: o.cust_name,
    custArea: o.cust_area,
    status: o.status,
    items: json.parse(o.items, []),
    customizations: json.parse(o.customizations || "[]", []),
    custPrefs: json.parse(o.cust_prefs || "{}", {}),
  }));

  res.json({
    date: todayISO,
    totalTiffins,
    items: Object.values(itemPlan).sort((a, b) => b.qty - a.qty),
    customizations: Object.entries(custPlan).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    activeOrderCount: activeOrders.length,
    subCount: activeSubs.length,
    orderDetails,
  });
});

/* ---- Customization Analytics ---- */
router.get("/customizations", (req, res) => {
  const orders = db.prepare("SELECT customizations FROM orders WHERE status != 'cancelled'").all();
  const custMap = {};
  let total = 0;
  orders.forEach(o => {
    const custs = json.parse(o.customizations || "[]", []);
    if (custs.length) total++;
    custs.forEach(c => { custMap[c] = (custMap[c] || 0) + 1; });
  });
  const ordersWithCust = orders.filter(o => json.parse(o.customizations || "[]", []).length > 0).length;
  res.json({
    total: orders.length,
    ordersWithCustomizations: ordersWithCust,
    pct: orders.length ? Math.round(ordersWithCust / orders.length * 100) : 0,
    items: Object.entries(custMap).map(([name, count]) => ({ name, count, pct: orders.length ? Math.round(count / orders.length * 100) : 0 })).sort((a, b) => b.count - a.count),
  });
});

module.exports = router;
