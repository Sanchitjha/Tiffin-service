/* App bootstrap — auth gate, icon injection, keyboard, initial route */
(async function init() {
  if (!Auth.requireAuth()) return;

  // Populate topbar icons
  document.getElementById("menuBtn").innerHTML = ic("menu", 18);
  document.getElementById("cmdkBtn").innerHTML = ic("command", 18);
  document.getElementById("qaIco").innerHTML = ic("plus", 14);
  document.getElementById("searchIco").innerHTML = ic("search", 15);
  UI.applyTheme();

  // Verify token still valid; if not, redirect to login
  try { State.user = await API.auth.me(); }
  catch { Auth.logout(); return; }

  // Global keyboard
  window.addEventListener("keydown", e => {
    const inField = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "SELECT");
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); UI.openCmdK(); }
    else if (e.key === "Escape") { UI.closeModal(); UI.closeCmdK(); UI.closePopover(); }
    else if (e.key === "/" && !inField) { e.preventDefault(); document.getElementById("globalSearch").focus(); }
  });

  // Periodically check for new WhatsApp messages
  setInterval(async () => {
    try {
      const { count } = await API.whatsapp.unreadCount();
      const cur = State.whatsappThreads.reduce((s, t) => s + (t.unread || 0), 0);
      if (count !== cur) { await App.refresh(); renderNav(); updateBellDot(); }
    } catch {}
  }, 15000);

  // Restore page from URL hash, fallback to dashboard
  const VALID_ROUTES = ["dashboard","customers","orders","subscriptions","products","leads","partners","whatsapp","calendar","reports","settings"];
  const hashRoute = window.location.hash.replace("#", "");
  App.go(VALID_ROUTES.includes(hashRoute) ? hashRoute : "dashboard");

  // Browser back/forward button support
  window.addEventListener("hashchange", () => {
    const r = window.location.hash.replace("#", "");
    if (VALID_ROUTES.includes(r) && r !== State.route) App.go(r);
  });
})();
