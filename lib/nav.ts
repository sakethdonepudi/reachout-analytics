export type NavIconName =
  | "home"
  | "services"
  | "research"
  | "casesLocked"
  | "casesOpen"
  | "about"
  | "contact"
  | "login"
  | "dashboard"
  | "users"
  | "sessions"
  | "security"
  | "password"
  | "logout"
  | "database"
  | "ads";

export type NavItem = { key: string; label: string; href: string; icon: NavIconName };

/** Public order. The homepage and the other public pages share this list. */
export const PUBLIC_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: "home" },
  { key: "services", label: "Services", href: "/services", icon: "services" },
  { key: "research", label: "Research", href: "/services/research-content", icon: "research" },
  { key: "cases", label: "Case Studies", href: "/case-studies", icon: "casesLocked" },
  { key: "about", label: "About Us", href: "/about", icon: "about" },
  { key: "contact", label: "Contact", href: "/#contact", icon: "contact" },
];

/** Signed-in clients see the case dropdown second. */
export const CLIENT_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: "home" },
  { key: "cases", label: "Case Studies", href: "/case-studies", icon: "casesOpen" },
  { key: "services", label: "Services", href: "/services", icon: "services" },
  { key: "research", label: "Research", href: "/services/research-content", icon: "research" },
  { key: "about", label: "About Us", href: "/about", icon: "about" },
  { key: "contact", label: "Contact", href: "/#contact", icon: "contact" },
];

export const OWNER_NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { key: "cases", label: "Case Studies", href: "/case-studies", icon: "casesOpen" },
];

export const ADMIN_LOGIN: NavItem = { key: "login", label: "Admin Login", href: "/login", icon: "login" };
export const CASE_DASHBOARD: NavItem = { key: "case-dashboard", label: "Case studies dashboard", href: "/dashboard/case-studies", icon: "database" };
export const ADS_DESK: NavItem = { key: "ads", label: "Ads Desk", href: "/dashboard", icon: "ads" };

export const ACCOUNT_ITEMS = {
  users: { key: "users", label: "Users", href: "/account/users", icon: "users" as NavIconName },
  sessions: { key: "sessions", label: "Sessions", href: "/account/sessions", icon: "sessions" as NavIconName },
  security: { key: "security", label: "Security", href: "/account/security", icon: "security" as NavIconName },
  password: { key: "password", label: "Change password", href: "/account/password", icon: "password" as NavIconName },
  logout: { key: "logout", label: "Sign out", href: "/login", icon: "logout" as NavIconName },
};
