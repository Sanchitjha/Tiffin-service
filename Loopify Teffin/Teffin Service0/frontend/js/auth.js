/* Auth gate — redirect to /login if no token */
const Auth = {
  token() { return localStorage.getItem("dabbabox_token"); },
  user()  { try { return JSON.parse(localStorage.getItem("dabbabox_user") || "null"); } catch { return null; } },
  isAuthed() { return !!Auth.token(); },
  logout() {
    localStorage.removeItem("dabbabox_token");
    localStorage.removeItem("dabbabox_user");
    location.href = "/login";
  },
  requireAuth() { if (!Auth.isAuthed()) { location.href = "/login"; return false; } return true; },
};
