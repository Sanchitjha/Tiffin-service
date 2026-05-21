const { db } = require("./db");

/**
 * Handle incoming WhatsApp message and generate a chatbot response.
 * @param {Object} message - { phone, name, text }
 * @returns {String|null} - The bot's reply text, or null if no reply should be sent.
 */
async function generateBotReply(message) {
  const text = message.text.toLowerCase().trim();

  // 1. GREETINGS
  if (text === "hi" || text === "hello" || text === "hey" || text === "start") {
    return `👋 Hello ${message.name || "there"}! Welcome to DabbaBox Tiffin Service.\n\nHere is what I can help you with today. Please reply with one of the following keywords:\n\n🍱 *Menu* - See today's tiffin menu & prices\n📅 *Subscribe* - View daily/weekly/monthly plans\n🚚 *Delivery* - Check delivery areas & timing\n🥗 *Diet* - Veg, Non-Veg & Jain options\n📞 *Agent* - Talk to a human`;
  }

  // 2. MENU & PRICES
  if (text.includes("menu") || text.includes("price") || text.includes("tiffin") || text.includes("dabba") || text.includes("cost") || text.includes("food") || text.includes("list")) {
    return `🍱 *Today's Tiffin Menu*:\n\n*Veg Tiffin* 🥗 - ₹120\nDal, Sabzi, Roti (3), Rice, Salad, Pickle\n\n*Non-Veg Tiffin* 🍗 - ₹160\nChicken Curry / Egg Curry, Roti (3), Rice, Salad\n\n*Jain Tiffin* 🌿 - ₹130\nNo root vegetables, Roti (3), Rice, Dal, Dry Sabzi\n\n*Full Thali* 🍛 - ₹180\nDal, 2 Sabzi, Roti (4), Rice, Sweet, Papad, Pickle\n\nReply with a plan name or type *Subscribe* to set up daily delivery!`;
  }

  // 3. SUBSCRIPTIONS
  if (text.includes("subscribe") || text.includes("subscription") || text.includes("plan") || text.includes("package") || text.includes("monthly") || text.includes("weekly")) {
    return `📅 *Our Tiffin Subscription Plans*:\n\n*Daily Plan (Lunch only):* ₹120/day\n*Daily Plan (Lunch + Dinner):* ₹220/day\n\n*Weekly Pack:* 7 days - ₹799 (Save ₹41)\n*Monthly Pack:* 30 days - ₹3,299 (Save ₹301 + Free Delivery!)\n\nAll plans include freshly cooked, home-style meals.\nReply with *Weekly* or *Monthly* to get started, or type *Menu* to see today's options!`;
  }

  // 4. DELIVERY INFO
  if (text.includes("delivery") || text.includes("deliver") || text.includes("area") || text.includes("time") || text.includes("location") || text.includes("timing")) {
    return `🚚 *Delivery Information*:\n\nWe deliver fresh, home-cooked tiffins across the city!\n\n*Lunch delivery:* 11:30 AM - 1:30 PM\n*Dinner delivery:* 7:00 PM - 9:00 PM\n\nDelivery is *FREE* for monthly subscribers and orders above ₹250. Standard delivery fee is ₹30.\n\nType your area name to check if we deliver there, or type *Agent* to confirm.`;
  }

  // 5. DIETARY / SPECIAL REQUIREMENTS
  if (text.includes("veg") || text.includes("non-veg") || text.includes("jain") || text.includes("diet") || text.includes("allerg") || text.includes("spicy") || text.includes("special")) {
    return `🥗 *Dietary Options*:\n\nWe cater to all dietary needs!\n\n✅ *Pure Veg* — No onion/garlic option available\n✅ *Non-Veg* — Chicken, Egg (no beef/pork)\n✅ *Jain* — No root vegetables, no onion/garlic\n✅ *Low-Spice* — Mild seasoning on request\n\nPlease mention your preference when subscribing and we will customise your dabba every day!`;
  }

  // 6. HUMAN HANDOFF
  if (text.includes("agent") || text.includes("human") || text.includes("help") || text.includes("talk") || text.includes("customer care") || text.includes("complaint") || text.includes("issue")) {
    return `🧑‍💼 I am connecting you with one of our team members right away. They will read your message and reply to you shortly!\n\nFor urgent matters, you can also call us directly.`;
  }

  // 7. BASIC ORDERING / INTENT CATCHER
  if (text.includes("order") || text.includes("buy") || text.includes("start") || text.includes("today")) {
    return `✅ Great choice! Please share your:\n1. *Full delivery address*\n2. *Preferred meal plan* (Veg / Non-Veg / Jain)\n3. *Delivery slot* (Lunch / Dinner / Both)\n\nOur team will confirm your order and first delivery timing within a few minutes!`;
  }

  // 8. FALLBACK / UNKNOWN MESSAGE
  return `🤖 I'm sorry, I didn't quite catch that.\n\nPlease type one of these keywords:\n*Menu* — Today's tiffin options\n*Subscribe* — Meal plans & pricing\n*Delivery* — Timing & areas\n*Diet* — Veg, Non-Veg, Jain options\n*Agent* — Talk to our team`;
}

module.exports = { generateBotReply };
