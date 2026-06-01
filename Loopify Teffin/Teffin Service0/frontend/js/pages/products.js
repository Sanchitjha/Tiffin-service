function pageProducts() {
  const q = State.search;
  let prods = State.products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q));
  prods = prods.sort((a, b) => a.name.localeCompare(b.name));
  const low = State.products.filter(p => p.stock <= p.lowStockAt).length;
  const totalValue = State.products.reduce((s, p) => s + p.stock * p.price, 0);
  return `
    <div class="page-header"><div><div class="page-h1">Products & inventory</div><div class="page-h1-sub">${prods.length} products • ${low} low-stock • ${fmtINR(totalValue)} stock value</div></div><button class="btn btn-primary" onclick="openProductForm()">${ic("plus", 13)}<span>Add product</span></button></div>
    <div class="prod-grid">
      ${prods.length ? prods.map(p => { const pct = Math.min(100, Math.round(p.stock / (p.lowStockAt * 4 || 20) * 100)); const isLow = p.stock <= p.lowStockAt; return `<div class="prod-card" onclick="openProductForm('${p.id}')">
        <div class="prod-emoji-wrap">${esc(p.emoji || "🍱")}</div>
        <div class="prod-name">${esc(p.name)}</div>
        ${p.category ? `<div class="muted" style="font-size:12px;margin-bottom:6px">${esc(p.category)}</div>` : ""}
        <div class="between" style="margin-top:8px"><div class="prod-price num">${fmtINR(p.price)}</div>${isLow ? `<span class="badge badge-danger"><span class="dot"></span>${p.stock} left</span>` : `<span class="badge badge-success"><span class="dot"></span>${p.stock} in stock</span>`}</div>
        <div class="prog"><div class="bar ${isLow ? "low" : ""}" style="width:${pct}%"></div></div>
        ${p.description ? `<div class="muted" style="font-size:11.5px;margin-top:8px;line-height:1.4">${esc(p.description)}</div>` : ""}
      </div>`; }).join("") : emptyState("cup", "No products", "Add your tiffin menu items so you can record orders and track stock.", "Add product", "openProductForm()")}
    </div>`;
}

async function openProductForm(id) {
  let p, moves = [];
  if (id) { try { const r = await API.products.get(id); p = r; moves = r.stockMoves || []; } catch (e) { UI.toast(e.message, "error"); return; } }
  else p = { id: "", name: "", emoji: "🍱", category: "", price: 0, stock: 0, lowStockAt: 5, description: "" };
  UI.openModal(`
    <div class="modal-head"><div><div class="modal-title">${id ? "Edit product" : "New product"}</div><div class="modal-sub">Tiffin menu item</div></div><button class="icon-btn" onclick="UI.closeModal()">${ic("x", 16)}</button></div>
    <div class="modal-body">
      <div class="field"><label class="lbl">Product name *</label><input id="f_name" class="input" value="${esc(p.name)}"/></div>
      <div class="field-row">
        <div class="field"><label class="lbl">Emoji</label><input id="f_emoji" class="input" value="${esc(p.emoji || "🍱")}" maxlength="2" style="text-align:center;font-size:18px"/></div>
        <div class="field"><label class="lbl">Category</label><input id="f_cat" class="input" value="${esc(p.category || "")}" placeholder="Veg / Non-Veg / Jain / Combo"/></div>
      </div>
      <div class="field-row-3">
        <div class="field"><label class="lbl">Price (₹) *</label><input id="f_price" class="input" type="number" min="0" value="${p.price}"/></div>
        <div class="field"><label class="lbl">Stock</label><input id="f_stock" class="input" type="number" min="0" value="${p.stock}"/></div>
        <div class="field"><label class="lbl">Low-stock at</label><input id="f_low" class="input" type="number" min="0" value="${p.lowStockAt || 5}"/></div>
      </div>
      <div class="field"><label class="lbl">Description</label><textarea id="f_desc" class="textarea" rows="3">${esc(p.description || "")}</textarea></div>
      ${id ? `<div class="card card-pad" style="background:var(--c-surface-2)"><div class="card-sub" style="margin-bottom:6px">RECENT STOCK MOVEMENTS</div>${moves.length ? moves.slice(0, 5).map(m => `<div class="between" style="font-size:12.5px;padding:3px 0"><span class="muted">${fmtTime(m.at)}</span><span style="color:${m.delta < 0 ? "var(--c-danger)" : "var(--c-success)"};font-weight:600">${m.delta > 0 ? "+" : ""}${m.delta}</span><span class="muted" style="font-size:11px;text-align:right;flex:1;margin-left:8px">${esc(m.reason || "")}</span></div>`).join("") : '<div class="muted" style="font-size:12px;padding:4px 0">No movements yet.</div>'}</div>` : ""}
    </div>
    <div class="modal-foot">${id ? `<button class="btn btn-danger" onclick="deleteProduct('${p.id}')">${ic("trash", 13)}<span>Delete</span></button>` : ""}<div class="spacer"></div><button class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveProduct('${p.id}')">${ic("check", 13)}<span>Save</span></button></div>
  `, "md");
}
async function saveProduct(id) {
  const name = document.getElementById("f_name").value.trim();
  if (!name) { UI.toast("Name required", "error"); return; }
  const body = {
    name,
    emoji: document.getElementById("f_emoji").value.trim() || "🍱",
    category: document.getElementById("f_cat").value.trim(),
    price: parseFloat(document.getElementById("f_price").value) || 0,
    stock: parseInt(document.getElementById("f_stock").value) || 0,
    lowStockAt: parseInt(document.getElementById("f_low").value) || 5,
    description: document.getElementById("f_desc").value.trim(),
  };
  try { if (id) await API.products.update(id, body); else await API.products.create(body); await App.refresh(); UI.closeModal(); UI.toast("Product saved", "success"); App.render(); }
  catch (e) { UI.toast(e.message, "error"); }
}
function deleteProduct(id) { UI.confirm("Delete this product?", async () => { try { await API.products.delete(id); await App.refresh(); UI.closeModal(); UI.toast("Deleted", "success"); App.render(); } catch (e) { UI.toast(e.message, "error"); } }, true); }
