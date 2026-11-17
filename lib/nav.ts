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

/** Signed-out and static navigation. The workspace is login first. */
export const PUBLIC_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: "home" },
  { key: "cases", label: "Case Studies", href: "/case-studies", icon: "casesOpen" },
];

/** Signed-in clients see the case dropdown second. */
export const CLIENT_NAV: NavItem[] = [
  { key: "home", label: "Home", href: "/", icon: "home" },
  { key: "cases", label: "Case Studies", href: "/case-studies", icon: "casesOpen" },
];

export const OWNER_NAV: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { key: "cases", label: "Case Studies", href: "/case-studies", icon: "casesOpen" },
];

export const LOGIN: NavItem = { key: "login", label: "Login", href: "/login", icon: "login" };
export const ADS_DESK: NavItem = { key: "ads", label: "Ads Desk", href: "/dashboard", icon: "ads" };

export const ACCOUNT_ITEMS = {
  account: { key: "account", label: "Account", href: "/account/security", icon: "security" as NavIconName },
  users: { key: "users", label: "Users", href: "/account/users", icon: "users" as NavIconName },
  sessions: { key: "sessions", label: "Sessions", href: "/account/sessions", icon: "sessions" as NavIconName },
  security: { key: "security", label: "Security", href: "/account/security", icon: "security" as NavIconName },
  password: { key: "password", label: "Change password", href: "/account/password", icon: "password" as NavIconName },
  logout: { key: "logout", label: "Sign out", href: "/login", icon: "logout" as NavIconName },
};
