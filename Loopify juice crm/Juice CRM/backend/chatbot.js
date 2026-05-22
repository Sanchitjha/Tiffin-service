const { db, uid } = require("./db");

// Initialize bot_sessions table
db.exec(`
CREATE TABLE IF NOT EXISTS bot_sessions (
  phone TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

function getSession(phone) {
  const row = db.prepare("SELECT * FROM bot_sessions WHERE phone = ?").get(phone);
  if (row) {
    try {
      return {
        state: row.state,
        data: JSON.parse(row.data)
      };
    } catch (e) {
      return { state: "IDLE", data: {} };
    }
  }
  return { state: "IDLE", data: {} };
}

function saveSession(phone, state, data) {
  db.prepare("INSERT INTO bot_sessions (phone, state, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(phone) DO UPDATE SET state=excluded.state, data=excluded.data, updated_at=excluded.updated_at")
    .run(phone, state, JSON.stringify(data), Date.now());
}

function clearSession(phone) {
  db.prepare("DELETE FROM bot_sessions WHERE phone = ?").run(phone);
}

function parseDirectOrder(text) {
  let address = "";
  let plan = "";
  let slot = "";

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  
  let item1 = "";
  let item2 = "";
  let item3 = "";
  
  for (const line of lines) {
    if (/^1[\.\s\:\)]+/i.test(line)) {
      item1 = line.replace(/^1[\.\s\:\)]+/i, "").trim();
    } else if (/^2[\.\s\:\)]+/i.test(line)) {
      item2 = line.replace(/^2[\.\s\:\)]+/i, "").trim();
    } else if (/^3[\.\s\:\)]+/i.test(line)) {
      item3 = line.replace(/^3[\.\s\:\)]+/i, "").trim();
    }
  }

  if (item1 && item2 && item3) {
    address = item1;
    plan = item2;
    slot = item3;
  } else if (lines.length >= 3) {
    // Check if one of the lines contains lunch/dinner/both
    const slotIdx = lines.findIndex(l => /lunch|dinner|both/i.test(l));
    const planIdx = lines.findIndex(l => /veg|jain|thali|weekly|monthly/i.test(l));
    if (slotIdx !== -1 && planIdx !== -1 && slotIdx !== planIdx) {
      slot = lines[slotIdx];
      plan = lines[planIdx];
      address = lines.filter((_, idx) => idx !== slotIdx && idx !== planIdx).join(", ");
    }
  }

  if (address && plan && slot) {
    return { address, plan, slot };
  }
  return null;
}

function createOrderAndSubscription(message, address, planText, slot) {
  const cleanPhone = (p) => (p || "").replace(/\D/g, "");
  const phoneCleaned = cleanPhone(message.phone);
  
  // Find customer by phone
  const customers = db.prepare("SELECT * FROM customers").all();
  let customer = customers.find(c => cleanPhone(c.phone) === phoneCleaned);
  
  const customerName = message.name || "WhatsApp Customer";
  const customerId = customer ? customer.id : uid("c_");

  if (!customer) {
    db.prepare("INSERT INTO customers (id, name, phone, email, area, address, tags, notes, preferences, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(customerId, customerName, message.phone, null, null, address, JSON.stringify(["whatsapp"]), "Created via WhatsApp chatbot", JSON.stringify({ dietaryType: planText }), Date.now());
  } else {
    db.prepare("UPDATE customers SET address = ?, preferences = ? WHERE id = ?")
      .run(address, JSON.stringify({ ...JSON.parse(customer.preferences || "{}"), dietaryType: planText }), customer.id);
  }

  // Find product
  const products = db.prepare("SELECT * FROM products").all();
  let selectedProduct = products.find(p => p.name.toLowerCase().includes(planText.toLowerCase()) || planText.toLowerCase().includes(p.name.toLowerCase()));
  if (!selectedProduct) {
    if (planText.toLowerCase().includes("jain")) {
      selectedProduct = products.find(p => p.name === "Jain Tiffin");
    } else if (planText.toLowerCase().includes("non")) {
      selectedProduct = products.find(p => p.name === "Non-Veg Tiffin");
    } else if (planText.toLowerCase().includes("thali")) {
      selectedProduct = products.find(p => p.name === "Full Thali");
    } else {
      selectedProduct = products.find(p => p.name === "Veg Tiffin");
    }
  }
  if (!selectedProduct) {
    selectedProduct = products[0];
  }

  // Map frequency
  let frequency = "daily";
  if (planText.toLowerCase().includes("week")) frequency = "weekly";
  if (planText.toLowerCase().includes("month")) frequency = "monthly";

  // Map total prices
  let subtotal = selectedProduct.price;
  let deliveryFee = 30;
  if (frequency === "weekly") {
    subtotal = 799;
    deliveryFee = 0;
  } else if (frequency === "monthly") {
    subtotal = 3299;
    deliveryFee = 0;
  }
  const total = subtotal + deliveryFee;

  // Create Order
  const orderId = uid("o_");
  const orderItems = [{ productId: selectedProduct.id, name: selectedProduct.name, qty: 1, price: selectedProduct.price }];
  const events = [{ at: Date.now(), status: "pending", note: "Order created via chatbot" }];
  
  db.prepare("INSERT INTO orders (id, customer_id, partner_id, delivery_address, items, customizations, status, notes, delivery_fee, subtotal, total, events, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(orderId, customerId, null, address, JSON.stringify(orderItems), JSON.stringify([]), "pending", `Slot: ${slot}`, deliveryFee, subtotal, total, JSON.stringify(events), Date.now());

  // Create Subscription
  const subId = uid("s_");
  const nextDeliveryDate = new Date();
  nextDeliveryDate.setDate(nextDeliveryDate.getDate() + 1);
  const nextDeliveryStr = nextDeliveryDate.toISOString().slice(0, 10);

  db.prepare("INSERT INTO subscriptions (id, name, customer_id, frequency, status, next_delivery, items, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(subId, `${selectedProduct.name} ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Plan`, customerId, frequency, "active", nextDeliveryStr, JSON.stringify(orderItems), Date.now());

  // Log activity
  db.prepare("INSERT INTO activity (id, at, text, kind, ref) VALUES (?, ?, ?, ?, ?)")
    .run(uid("a_"), Date.now(), `Chatbot order #${orderId.slice(-6).toUpperCase()} created for ${customerName} • ₹${total}`, "info", JSON.stringify({ orderId }));
}

async function generateBotReply(message) {
  const text = message.text.toLowerCase().trim();
  const phone = message.phone;

  // Handle global cancellation commands in any state
  if (text === "cancel" || text === "stop" || text === "restart") {
    clearSession(phone);
    return `❌ Order cancelled. Reply with *Hi* to see the main menu or *Order* to start a new order.`;
  }

  // Load session
  const session = getSession(phone);

  // Check for direct order parsing format (e.g. numbered address, plan, slot)
  // ONLY if not already in the middle of a step-by-step confirmation
  if (session.state !== "AWAITING_CONFIRMATION") {
    const directOrder = parseDirectOrder(message.text);
    if (directOrder) {
      try {
        createOrderAndSubscription(message, directOrder.address, directOrder.plan, directOrder.slot);
        clearSession(phone);
        return `🎉 *Thank you for your order!* \n\nYour order has been received:\n- *Plan:* ${directOrder.plan}\n- *Address:* ${directOrder.address}\n- *Slot:* ${directOrder.slot}\n\nOur team will confirm your delivery slot shortly. 🍱`;
      } catch (err) {
        console.error("Direct order creation failed:", err);
        return `❌ Sorry, there was an issue creating your order. Please reply with *Order* to try step-by-step, or *Agent* to speak with our support team.`;
      }
    }
  }

  // State Machine logic
  switch (session.state) {
    case "AWAITING_PLAN": {
      let matchedPlan = "";
      let frequency = "daily";
      
      if (text === "1" || text.includes("veg tiffin") || text === "veg") {
        matchedPlan = "Veg Tiffin";
      } else if (text === "2" || text.includes("non-veg tiffin") || text === "non-veg" || text.includes("non veg")) {
        matchedPlan = "Non-Veg Tiffin";
      } else if (text === "3" || text.includes("jain tiffin") || text === "jain") {
        matchedPlan = "Jain Tiffin";
      } else if (text === "4" || text.includes("full thali") || text === "thali") {
        matchedPlan = "Full Thali";
      } else if (text === "5" || text.includes("weekly pack") || text === "weekly") {
        matchedPlan = "Weekly Pack";
        frequency = "weekly";
      } else if (text === "6" || text.includes("monthly pack") || text === "monthly") {
        matchedPlan = "Monthly Pack";
        frequency = "monthly";
      }

      if (matchedPlan) {
        session.data.plan = matchedPlan;
        session.data.frequency = frequency;
        saveSession(phone, "AWAITING_ADDRESS", session.data);
        return `🚚 *Great choice (${matchedPlan})!*\n\nPlease share your *Full Delivery Address*.\n\n_(Reply with your address, or type *Cancel* to stop)_`;
      } else {
        return `🤖 I didn't catch that. Please reply with a number (1-6) or the plan name:\n\n1. *Veg Tiffin* (₹120/day)\n2. *Non-Veg Tiffin* (₹160/day)\n3. *Jain Tiffin* (₹130/day)\n4. *Full Thali* (₹180/day)\n5. *Weekly Pack* (₹799/7 days)\n6. *Monthly Pack* (₹3,299/30 days)\n\nType *Cancel* to stop.`;
      }
    }

    case "AWAITING_ADDRESS": {
      if (message.text.trim().length < 5) {
        return `🤖 Please enter a complete delivery address.\n\n_(Or type *Cancel* to stop)_`;
      }
      session.data.address = message.text.trim();
      saveSession(phone, "AWAITING_SLOT", session.data);
      return `🕒 *Delivery Slot*:\nWhen would you like your tiffin delivered?\n\n1. *Lunch* (11:30 AM - 1:30 PM)\n2. *Dinner* (7:00 PM - 9:00 PM)\n3. *Both* (Lunch + Dinner)\n\nPlease reply with *1*, *2*, or *3* (or type *Cancel* to stop).`;
    }

    case "AWAITING_SLOT": {
      let matchedSlot = "";
      if (text === "1" || text.includes("lunch")) {
        matchedSlot = "Lunch";
      } else if (text === "2" || text.includes("dinner")) {
        matchedSlot = "Dinner";
      } else if (text === "3" || text.includes("both")) {
        matchedSlot = "Both";
      }

      if (matchedSlot) {
        session.data.slot = matchedSlot;
        saveSession(phone, "AWAITING_CONFIRMATION", session.data);
        return `🛒 *Confirm your order details*:\n\n- *Plan:* ${session.data.plan}\n- *Address:* ${session.data.address}\n- *Slot:* ${matchedSlot}\n\nReply with *Confirm* to place your order, or *Cancel* to start over.`;
      } else {
        return `🤖 Please reply with a valid slot number or name:\n\n1. *Lunch* (11:30 AM - 1:30 PM)\n2. *Dinner* (7:00 PM - 9:00 PM)\n3. *Both* (Lunch + Dinner)\n\nType *Cancel* to stop.`;
      }
    }

    case "AWAITING_CONFIRMATION": {
      if (text === "confirm" || text === "yes" || text === "ok" || text === "1" || text === "place order") {
        try {
          createOrderAndSubscription(message, session.data.address, session.data.plan, session.data.slot);
          clearSession(phone);
          return `🎉 *Thank you for your order!* \nYour subscription has been set up successfully. Our delivery partner will reach out to you shortly. 🍱\n\nReply with *Hi* at any time to see the main menu.`;
        } catch (err) {
          console.error("Order confirmation failed:", err);
          return `❌ Sorry, there was an issue creating your order. Please reply with *Agent* to speak with our support team.`;
        }
      } else {
        return `🤖 Please reply with *Confirm* to place your order, or *Cancel* to start over.\n\n- *Plan:* ${session.data.plan}\n- *Address:* ${session.data.address}\n- *Slot:* ${session.data.slot}`;
      }
    }

    default: {
      // IDLE State: handle standard commands or shortcut ordering
      if (text === "hi" || text === "hello" || text === "hey" || text === "start" || text === "menu") {
        if (text === "menu") {
          return `🍱 *Today's Tiffin Menu*:\n\n*Veg Tiffin* 🥗 - ₹120\nDal, Sabzi, Roti (3), Rice, Salad, Pickle\n\n*Non-Veg Tiffin* 🍗 - ₹160\nChicken Curry / Egg Curry, Roti (3), Rice, Salad\n\n*Jain Tiffin* 🌿 - ₹130\nNo root vegetables, Roti (3), Rice, Dal, Dry Sabzi\n\n*Full Thali* 🍛 - ₹180\nDal, 2 Sabzi, Roti (4), Rice, Sweet, Papad, Pickle\n\nReply with *Order* or *Subscribe* to set up daily delivery!`;
        }
        return `👋 Hello ${message.name || "there"}! Welcome to DabbaBox Tiffin Service.\n\nHere is what I can help you with today. Please reply with one of the following keywords:\n\n🍱 *Menu* - See today's tiffin menu & prices\n📅 *Subscribe* - View daily/weekly/monthly plans\n🛍️ *Order* - Place a new order/subscription\n🚚 *Delivery* - Check delivery areas & timing\n🥗 *Diet* - Veg, Non-Veg & Jain options\n📞 *Agent* - Talk to a human`;
      }

      // Check if they want to order directly by stating plan name in IDLE state
      let matchedPlan = "";
      let frequency = "daily";
      
      if (text === "veg" || text.includes("veg tiffin") || text === "veg tuffin") {
        matchedPlan = "Veg Tiffin";
      } else if (text === "non-veg" || text === "non veg" || text.includes("non-veg tiffin") || text.includes("non veg tiffin")) {
        matchedPlan = "Non-Veg Tiffin";
      } else if (text === "jain" || text.includes("jain tiffin")) {
        matchedPlan = "Jain Tiffin";
      } else if (text === "thali" || text.includes("full thali")) {
        matchedPlan = "Full Thali";
      } else if (text === "weekly" || text.includes("weekly pack")) {
        matchedPlan = "Weekly Pack";
        frequency = "weekly";
      } else if (text === "monthly" || text.includes("monthly pack")) {
        matchedPlan = "Monthly Pack";
        frequency = "monthly";
      }

      if (matchedPlan) {
        const initialData = { plan: matchedPlan, frequency };
        saveSession(phone, "AWAITING_ADDRESS", initialData);
        return `🚚 *Great choice (${matchedPlan})!*\n\nPlease share your *Full Delivery Address*.\n\n_(Reply with your address, or type *Cancel* to stop)_`;
      }

      // Trigger order state flow via ordering keywords
      if (text === "order" || text === "buy" || text === "subscribe" || text === "daily plan") {
        saveSession(phone, "AWAITING_PLAN", {});
        return `🍱 *Which meal plan would you like to order?*\n\n1. *Veg Tiffin* 🥗 — ₹120/day\n2. *Non-Veg Tiffin* 🍗 — ₹160/day\n3. *Jain Tiffin* 🌿 — ₹130/day\n4. *Full Thali* 🍛 — ₹180/day\n5. *Weekly Pack* 📅 — ₹799 (7 days)\n6. *Monthly Pack* 📆 — ₹3,299 (30 days)\n\nPlease reply with the plan name or number (e.g., *1* or *Veg Tiffin*).`;
      }

      // Subscriptions plans info
      if (text.includes("subscription") || text.includes("package") || text.includes("plan")) {
        return `📅 *Our Tiffin Subscription Plans*:\n\n*Daily Plan (Lunch only):* ₹120/day\n*Daily Plan (Lunch + Dinner):* ₹220/day\n\n*Weekly Pack:* 7 days - ₹799 (Save ₹41)\n*Monthly Pack:* 30 days - ₹3,299 (Save ₹301 + Free Delivery!)\n\nAll plans include freshly cooked, home-style meals.\nReply with *Order* or *Subscribe* to get started!`;
      }

      // Delivery Info
      if (text.includes("delivery") || text.includes("deliver") || text.includes("area") || text.includes("time") || text.includes("location") || text.includes("timing")) {
        return `🚚 *Delivery Information*:\n\nWe deliver fresh, home-cooked tiffins across the city!\n\n*Lunch delivery:* 11:30 AM - 1:30 PM\n*Dinner delivery:* 7:00 PM - 9:00 PM\n\nDelivery is *FREE* for monthly subscribers and orders above ₹250. Standard delivery fee is ₹30.\n\nType your area name to check if we deliver there, or type *Agent* to confirm.`;
      }

      // Diet / Special requirements
      if (text.includes("veg") || text.includes("non-veg") || text.includes("jain") || text.includes("diet") || text.includes("allerg") || text.includes("spicy") || text.includes("special")) {
        return `🥗 *Dietary Options*:\n\nWe cater to all dietary needs!\n\n✅ *Pure Veg* — No onion/garlic option available\n✅ *Non-Veg* — Chicken, Egg (no beef/pork)\n✅ *Jain* — No root vegetables, no onion/garlic\n✅ *Low-Spice* — Mild seasoning on request\n\nPlease reply with *Order* to customize your preference when subscribing!`;
      }

      // Human handoff
      if (text.includes("agent") || text.includes("human") || text.includes("talk") || text.includes("customer care") || text.includes("complaint") || text.includes("issue") || text.includes("help")) {
        return `🧑‍💼 I am connecting you with one of our team members right away. They will read your message and reply to you shortly!\n\nFor urgent matters, you can also call us directly.`;
      }

      // Fallback
      return `🤖 I'm sorry, I didn't quite catch that.\n\nPlease type one of these keywords:\n*Menu* — Today's tiffin options\n*Subscribe* — Meal plans & pricing\n*Order* — Place a new order/subscription\n*Delivery* — Timing & areas\n*Diet* — Veg, Non-Veg, Jain options\n*Agent* — Talk to our team`;
    }
  }
}

module.exports = { generateBotReply };

