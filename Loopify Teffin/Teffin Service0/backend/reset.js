/* Wipes all data and reseeds. */
const { db } = require("./db");
const seed = require("./seed");

const tables = ["customers","orders","subscriptions","products","leads","partners","whatsapp_messages","stock_moves","activity","settings"];
const tx = db.transaction(() => { tables.forEach(t => db.prepare(`DELETE FROM ${t}`).run()); });
tx();
console.log("✓ Cleared all data");
seed();
