/* =========================================================================
   Demo data seeder
   ========================================================================= */
const { db, uid, json } = require("./db");

function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seed() {
  const tx = db.transaction(() => {
    // Products
    const products = [
      { name: "Veg Tiffin",        emoji: "🥗", category: "Veg",       price: 120, stock: 80, lowStockAt: 15, description: "Dal, Sabzi, Roti (3), Rice, Salad, Pickle" },
      { name: "Non-Veg Tiffin",    emoji: "🍗", category: "Non-Veg",   price: 160, stock: 50, lowStockAt: 10, description: "Chicken/Egg Curry, Roti (3), Rice, Salad" },
      { name: "Jain Tiffin",       emoji: "🌿", category: "Jain",      price: 130, stock: 30, lowStockAt:  8, description: "No root vegetables, Roti (3), Rice, Dal, Dry Sabzi" },
      { name: "Full Thali",        emoji: "🍛", category: "Thali",     price: 180, stock: 60, lowStockAt: 10, description: "Dal, 2 Sabzi, Roti (4), Rice, Sweet, Papad, Pickle" },
      { name: "Lunch + Dinner",    emoji: "🍱", category: "Combo",     price: 220, stock: 40, lowStockAt: 10, description: "Both meals in one plan — Veg Tiffin for lunch and dinner" },
      { name: "Office Pack (5)",   emoji: "🏢", category: "Bulk",      price: 550, stock: 20, lowStockAt:  5, description: "5 Veg Tiffins packed for office delivery" },
      { name: "Diet Tiffin",       emoji: "🥦", category: "Diet",      price: 140, stock: 25, lowStockAt:  8, description: "Low-calorie, low-spice, no-sugar — steamed sabzi, multigrain roti" },
      { name: "Kids Tiffin",       emoji: "👦", category: "Kids",      price: 90,  stock: 30, lowStockAt:  8, description: "Smaller portion, mild spice — Dal, Sabzi, Roti (2), Rice" },
    ].map(p => ({ ...p, id: uid("p_") }));

    const pStmt = db.prepare("INSERT INTO products (id, name, emoji, category, price, stock, low_stock_at, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    products.forEach(p => pStmt.run(p.id, p.name, p.emoji, p.category, p.price, p.stock, p.lowStockAt, p.description));

    // Partners
    const partners = [
      { name: "Rakesh Kumar",  phone: "+919876500001", area: "Adajan",   vehicle: "Bike",    active: 1 },
      { name: "Anita Sharma",  phone: "+919876500002", area: "Vesu",     vehicle: "Scooter", active: 1 },
      { name: "Vijay Naik",    phone: "+919876500003", area: "Varachha", vehicle: "Bike",    active: 1 },
      { name: "Suresh Patil",  phone: "+919876500004", area: "Udhna",    vehicle: "Scooter", active: 0 },
    ].map(p => ({ ...p, id: uid("dp_") }));
    const dpStmt = db.prepare("INSERT INTO partners (id, name, phone, area, vehicle, active) VALUES (?, ?, ?, ?, ?, ?)");
    partners.forEach(p => dpStmt.run(p.id, p.name, p.phone, p.area, p.vehicle, p.active));

    // Customers
    const customerSeed = [
      { name: "Neha Kapoor",      phone: "+919811122233", email: "neha@example.com",    area: "Adajan",    tags: ["vip","monthly"] },
      { name: "Arjun Mehta",      phone: "+919811222334", email: "arjun@example.com",   area: "Vesu",      tags: ["office","bulk"] },
      { name: "Ishita Bose",      phone: "+919811333445", email: "ishita@example.com",  area: "Althan",    tags: ["jain"] },
      { name: "Vikram Reddy",     phone: "+919811445566", email: "vikram@example.com",  area: "Varachha",  tags: ["non-veg"] },
      { name: "Sara D'Souza",     phone: "+919811556677", email: "sara@example.com",    area: "Adajan",    tags: ["vip","family"] },
      { name: "Raghav Iyer",      phone: "+919811667788", email: "raghav@example.com",  area: "Pal",       tags: ["new"] },
      { name: "Anjali Krishnan",  phone: "+919811778899", email: "anjali@example.com",  area: "Katargam",  tags: ["diet"] },
      { name: "Karthik Nair",     phone: "+919811889900", email: "karthik@example.com", area: "Udhna",     tags: ["office","weekly"] },
      { name: "Pooja Agarwal",    phone: "+919811990011", email: "pooja@example.com",   area: "Piplod",    tags: ["family","kids"] },
      { name: "Deepak Singh",     phone: "+919811001122", email: "deepak@example.com",  area: "Sachin",    tags: ["bulk","office"] },
    ].map(c => ({ ...c, id: uid("c_"), address: `${c.area}, Surat`, createdAt: Date.now() - Math.random() * 60 * 86400000 }));

    const cStmt = db.prepare("INSERT INTO customers (id, name, phone, email, area, address, tags, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    customerSeed.forEach(c => cStmt.run(c.id, c.name, c.phone, c.email, c.area, c.address, json.stringify(c.tags), "", c.createdAt));

    // Customer preferences
    const PREF_POOL = [
      { dietaryType: "Veg",     spiceLevel: "Medium" },
      { dietaryType: "Veg",     spiceLevel: "Mild" },
      { dietaryType: "Non-Veg", spiceLevel: "Spicy" },
      { dietaryType: "Jain",    spiceLevel: "Mild" },
      { dietaryType: "Veg",     spiceLevel: "Spicy" },
      { dietaryType: "Diet",    spiceLevel: "Mild" },
      { dietaryType: "Non-Veg", spiceLevel: "Medium" },
      { dietaryType: "Veg",     spiceLevel: "Medium" },
      { dietaryType: "Jain",    spiceLevel: "Medium" },
      { dietaryType: "Veg",     spiceLevel: "Mild" },
    ];
    const prefStmt = db.prepare("UPDATE customers SET preferences = ? WHERE id = ?");
    customerSeed.forEach((c, i) => prefStmt.run(json.stringify(PREF_POOL[i]), c.id));

    // Orders — 60 across last 30 days
    const ALL_CUSTS = [
      "No Onion/Garlic", "Mild Spice", "Extra Spicy", "Extra Roti (+2)",
      "Less Salt", "No Pickle", "Extra Dal", "No Sugar/Sweets", "Less Oil",
    ];
    const oStmt = db.prepare("INSERT INTO orders (id, customer_id, partner_id, delivery_address, items, customizations, status, notes, delivery_fee, subtotal, total, events, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    for (let i = 0; i < 60; i++) {
      const cust = customerSeed[Math.floor(Math.random() * customerSeed.length)];
      const itemCount = 1 + Math.floor(Math.random() * 3);
      const items = []; const used = new Set();
      for (let j = 0; j < itemCount; j++) {
        let p; do { p = products[Math.floor(Math.random() * products.length)]; } while (used.has(p.id));
        used.add(p.id);
        items.push({ productId: p.id, name: p.name, qty: 1 + Math.floor(Math.random() * 4), price: p.price });
      }
      // 55% chance of having customizations
      const custs = Math.random() < 0.55
        ? ALL_CUSTS.filter(() => Math.random() < 0.35).slice(0, 3)
        : [];
      const subtotal = items.reduce((s, x) => s + x.qty * x.price, 0);
      const fee = [0, 30, 40][Math.floor(Math.random() * 3)];
      const daysAgo = Math.floor(Math.random() * 30);
      const status = daysAgo > 2 ? "delivered" : ["pending","confirmed","preparing","out_for_delivery"][Math.floor(Math.random() * 4)];
      const partner = Math.random() > 0.2 ? partners[Math.floor(Math.random() * partners.length)] : null;
      const createdAt = Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000);
      const events = [{ at: createdAt, status: "pending", note: "Order created" }];
      if (status !== "pending") events.unshift({ at: createdAt + 3600000, status, note: "Status updated" });
      oStmt.run(uid("o_"), cust.id, partner ? partner.id : null, cust.address, json.stringify(items), json.stringify(custs), status, "", fee, subtotal, subtotal + fee, json.stringify(events), createdAt);
    }

    // Subscriptions
    const subs = [
      { name: "Monthly Veg Plan — Neha",    customerId: customerSeed[0].id, frequency: "monthly", status: "active", nextDelivery: daysFromNow(1),  items: [{ productId: products[0].id, name: products[0].name, qty: 1, price: products[0].price }] },
      { name: "Daily Lunch + Dinner",       customerId: customerSeed[3].id, frequency: "daily",   status: "active", nextDelivery: daysFromNow(1),  items: [{ productId: products[4].id, name: products[4].name, qty: 1, price: products[4].price }] },
      { name: "Jain Monthly Plan",          customerId: customerSeed[2].id, frequency: "monthly", status: "paused", nextDelivery: daysFromNow(15), items: [{ productId: products[2].id, name: products[2].name, qty: 1, price: products[2].price }] },
      { name: "Office Bulk Pack — Arjun",   customerId: customerSeed[1].id, frequency: "weekly",  status: "active", nextDelivery: daysFromNow(2),  items: [{ productId: products[5].id, name: products[5].name, qty: 5, price: products[5].price }] },
      { name: "Family Full Thali — Sara",   customerId: customerSeed[4].id, frequency: "daily",   status: "active", nextDelivery: daysFromNow(1),  items: [{ productId: products[3].id, name: products[3].name, qty: 3, price: products[3].price }] },
    ];
    const sStmt = db.prepare("INSERT INTO subscriptions (id, name, customer_id, frequency, status, next_delivery, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    subs.forEach(s => sStmt.run(uid("s_"), s.name, s.customerId, s.frequency, s.status, s.nextDelivery, json.stringify(s.items), Date.now()));

    // Leads
    const leads = [
      { name: "Megha Singh",   phone: "+919800012345", source: "WhatsApp Bot", stage: "new",       followUp: daysFromNow(1), notes: "Asked about monthly tiffin pricing. Wants veg option." },
      { name: "Vivek Sharma",  phone: "+919800023456", source: "Instagram",    stage: "contacted", followUp: daysFromNow(2), notes: "Wants office bulk pack for 25 employees." },
      { name: "Pooja Rao",     phone: "+919800034567", source: "Referral",     stage: "qualified", followUp: daysFromNow(0), notes: "Ready to start daily tiffin plan for family of 4." },
      { name: "Aman Khanna",   phone: "+919800045678", source: "WhatsApp Bot", stage: "converted", followUp: "",              notes: "Now an active monthly subscriber." },
      { name: "Riya Bhatt",    phone: "+919800056789", source: "Website",      stage: "new",       followUp: daysFromNow(2), notes: "Corporate tiffin enquiry for IT company." },
      { name: "Tanmay Joshi",  phone: "+919800067890", source: "Walk-in",      stage: "lost",      followUp: "",              notes: "Went with another tiffin service." },
    ];
    const lStmt = db.prepare("INSERT INTO leads (id, name, phone, source, stage, follow_up, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    leads.forEach(l => lStmt.run(uid("l_"), l.name, l.phone, l.source, l.stage, l.followUp || null, l.notes, Date.now()));

    // WhatsApp inbox
    const waMsgs = [
      { phone: "+919800012345", name: "Megha Singh",  dir: "in",  text: "Hi, I saw your post on Instagram. Do you have a monthly tiffin subscription?", at: Date.now() - 3600000 * 5, unread: 1 },
      { phone: "+919800012345", name: "Megha Singh",  dir: "out", text: "Hello Megha! Yes — monthly veg tiffin plan at ₹3,299. Shall I share the full menu?", at: Date.now() - 3600000 * 4, unread: 0 },
      { phone: "+919800012345", name: "Megha Singh",  dir: "in",  text: "Yes please! Is there a Jain option too?",                                    at: Date.now() - 3600000 * 3, unread: 1 },
      { phone: "+919811122233", name: "Neha Kapoor",  dir: "in",  text: "Hi! What time will my tiffin arrive today?",                                 at: Date.now() - 3600000 * 2, unread: 1 },
      { phone: "+919800023456", name: "Vivek Sharma", dir: "in",  text: "Hey, I run an office in Vesu with 25 people. Can we try a bulk tiffin pack?", at: Date.now() - 3600000 * 8, unread: 1 },
    ];
    const wStmt = db.prepare("INSERT INTO whatsapp_messages (id, phone, name, direction, text, unread, at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    waMsgs.forEach(m => wStmt.run(uid("m_"), m.phone, m.name, m.dir, m.text, m.unread, m.at));

    // Activity
    db.prepare("INSERT INTO activity (id, at, text, kind, ref) VALUES (?, ?, ?, ?, ?)")
      .run(uid("a_"), Date.now(), "Demo data loaded — start exploring!", "info", null);

    // Settings — business profile
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run("business", json.stringify({ name: "DabbaBox Tiffin Service", address: "123 Ring Road, Adajan, Surat", gst: "", phone: "+91 98765 00000", email: "hello@dabbabox.in" }));
  });
  tx();
  console.log("✓ Demo data seeded");
}

module.exports = seed;
if (require.main === module) seed();
