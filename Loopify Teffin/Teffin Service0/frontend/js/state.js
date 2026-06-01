/* Global app state — refreshed from API on every page render */
const State = {
  user: null,
  customers: [],
  orders: [],
  subscriptions: [],
  products: [],
  leads: [],
  partners: [],
  whatsappThreads: [],
  whatsappMessages: {}, // phone -> messages[]
  activity: [],
  settings: {},
  business: { name: "DabbaBox Tiffin Service", address: "", phone: "", email: "", gst: "" },
  theme: localStorage.getItem("dabbabox_theme") || "light",
  route: "dashboard",
  search: "",
  loading: false,
};

/* Status helpers */
const ORDER_STAGES = ["pending","confirmed","preparing","out_for_delivery","delivered","cancelled"];
const ORDER_LABEL  = { pending:"Pending", confirmed:"Confirmed", preparing:"Preparing", out_for_delivery:"Out for delivery", delivered:"Delivered", cancelled:"Cancelled" };
const ORDER_BADGE  = { pending:"badge-accent", confirmed:"badge-info", preparing:"badge-purple", out_for_delivery:"badge-pink", delivered:"badge-success", cancelled:"badge-danger" };
function orderBadge(s) { return `<span class="badge ${ORDER_BADGE[s] || "badge-neutral"}"><span class="dot"></span>${ORDER_LABEL[s] || s}</span>`; }

const LEAD_STAGES = [
  { id: "new",       label: "New",       badge: "badge-info" },
  { id: "contacted", label: "Contacted", badge: "badge-purple" },
  { id: "qualified", label: "Qualified", badge: "badge-accent" },
  { id: "converted", label: "Converted", badge: "badge-success" },
  { id: "lost",      label: "Lost",      badge: "badge-danger" },
];

const PROVIDER_ROUTES = [
  { id: "dashboard",     label: "Dashboard",          icon: "dashboard", section: "OVERVIEW" },
  { id: "customers",     label: "Customers",          icon: "users",     section: "SALES" },
  { id: "orders",        label: "Orders",             icon: "package",   section: "SALES" },
  { id: "subscriptions", label: "Subscriptions",      icon: "repeat",    section: "SALES" },
  { id: "leads",         label: "Leads & Follow-ups", icon: "target",    section: "SALES" },
  { id: "products",      label: "Products",           icon: "cup",       section: "OPERATIONS" },
  { id: "partners",      label: "Delivery Partners",  icon: "truck",     section: "OPERATIONS" },
  { id: "whatsapp",      label: "WhatsApp Inbox",     icon: "message",   section: "OPERATIONS" },
  { id: "calendar",      label: "Calendar",           icon: "calendar",  section: "INSIGHTS" },
  { id: "reports",       label: "Reports",            icon: "chart",     section: "INSIGHTS" },
  { id: "settings",      label: "Settings",           icon: "settings",  section: "SYSTEM" },
];

const SUPER_ROUTES = [
  { id: "sa-dashboard",  label: "Overview",           icon: "dashboard", section: "SYSTEM OVERVIEW" },
  { id: "sa-providers",  label: "Providers/Tenants",  icon: "users",     section: "MANAGEMENT" },
  { id: "sa-billing",    label: "Invoices & Billing", icon: "package",   section: "MANAGEMENT" },
  { id: "sa-tickets",    label: "Support Tickets",    icon: "message",   section: "MANAGEMENT" },
  { id: "sa-settings",   label: "System Settings",    icon: "settings",  section: "SYSTEM" },
];

let ROUTES = PROVIDER_ROUTES;

// Super Admin state variables
State.saAnalytics = null;
State.saProviders = [];
State.saInvoices = [];
State.saTickets = [];
State.saSettings = {};
