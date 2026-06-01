/* API client — wraps fetch() with JWT bearer auth */
const API = (() => {
  const base = (window.BACKEND_URL || "") + "/api";
  function tokenHeaders() {
    const t = localStorage.getItem("dabbabox_token");
    return t ? { Authorization: "Bearer " + t } : {};
  }
  async function request(method, path, body) {
    const opts = { method, headers: { "Content-Type": "application/json", ...tokenHeaders() } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(base + path, opts);
    if (r.status === 401) { Auth.logout(); throw new Error("Session expired"); }
    let data = null;
    try { data = await r.json(); } catch {}
    if (!r.ok) throw new Error((data && data.error) || `HTTP ${r.status}`);
    return data;
  }

  return {
    get:  (p) => request("GET", p),
    post: (p, b) => request("POST", p, b),
    put:  (p, b) => request("PUT", p, b),
    patch:(p, b) => request("PATCH", p, b),
    del:  (p) => request("DELETE", p),

    // Resource-specific shortcuts
    customers:     { list: () => API.get("/customers"),     get: id => API.get("/customers/"+id), create: b => API.post("/customers", b), update: (id,b) => API.put("/customers/"+id, b), delete: id => API.del("/customers/"+id) },
    products:      { list: () => API.get("/products"),      get: id => API.get("/products/"+id),  create: b => API.post("/products", b),  update: (id,b) => API.put("/products/"+id, b),  delete: id => API.del("/products/"+id) },
    partners:      { list: () => API.get("/partners"),      get: id => API.get("/partners/"+id),  create: b => API.post("/partners", b),  update: (id,b) => API.put("/partners/"+id, b),  delete: id => API.del("/partners/"+id) },
    orders:        { list: (q="") => API.get("/orders"+(q?"?"+q:"")), get: id => API.get("/orders/"+id), create: b => API.post("/orders", b), update: (id,b) => API.put("/orders/"+id, b), patchStatus: (id,status) => API.patch("/orders/"+id+"/status", {status}), patchPartner: (id,partnerId) => API.patch("/orders/"+id+"/partner", {partnerId}), delete: id => API.del("/orders/"+id) },
    subscriptions: { list: () => API.get("/subscriptions"), create: b => API.post("/subscriptions", b), update: (id,b) => API.put("/subscriptions/"+id, b), toggle: id => API.patch("/subscriptions/"+id+"/toggle"), delete: id => API.del("/subscriptions/"+id) },
    leads:         { list: () => API.get("/leads"),         create: b => API.post("/leads", b), update: (id,b) => API.put("/leads/"+id, b), patchStage: (id,stage) => API.patch("/leads/"+id+"/stage", {stage}), convert: id => API.post("/leads/"+id+"/convert"), delete: id => API.del("/leads/"+id) },
    whatsapp:      { threads: () => API.get("/whatsapp/threads"), messages: phone => API.get("/whatsapp/messages?phone="+encodeURIComponent(phone)), reply: (phone,text) => API.post("/whatsapp/reply", {phone,text}), markRead: phone => API.post("/whatsapp/mark-read", {phone}), simulate: () => API.post("/whatsapp/simulate"), unreadCount: () => API.get("/whatsapp/unread-count") },
    reports:       { summary: range => API.get("/reports/summary?range="+range), dashboard: () => API.get("/reports/dashboard"), activity: (limit=20) => API.get("/reports/activity?limit="+limit), areaIntelligence: () => API.get("/reports/area-intelligence"), cookPlan: () => API.get("/reports/cook-plan"), customizations: () => API.get("/reports/customizations") },
    settings:      { all: () => API.get("/settings"), set: (k,v) => API.put("/settings/"+k, { value: v }), restore: (data) => API.post("/settings/backup/restore", data), reset: () => API.post("/settings/reset") },
    auth:          { me: () => API.get("/auth/me"), changePassword: (currentPassword, newPassword) => API.post("/auth/change-password", { currentPassword, newPassword }) },
    superadmin: {
      analytics: () => API.get("/superadmin/analytics"),
      providers: {
        list: () => API.get("/superadmin/providers"),
        create: b => API.post("/superadmin/providers", b),
        update: (id, b) => API.put("/superadmin/providers/" + id, b)
      },
      billing: {
        list: () => API.get("/superadmin/billing"),
        create: b => API.post("/superadmin/billing", b),
        update: (id, status) => API.put("/superadmin/billing/" + id, { status })
      },
      tickets: {
        list: () => API.get("/superadmin/tickets"),
        update: (id, status) => API.put("/superadmin/tickets/" + id, { status })
      },
      settings: {
        get: () => API.get("/superadmin/settings"),
        set: b => API.put("/superadmin/settings", b)
      }
    },
  };
})();
