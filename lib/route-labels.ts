const CASE_LABELS: Record<string, string> = {
  "tamil-nadu": "Opening Tamil Nadu",
  telangana: "Opening Telangana",
  "north-east-elections": "Opening North East",
  "andhra-pradesh-2024": "Opening Andhra Pradesh",
  gujarat: "Opening Gujarat",
  bihar: "Opening Bihar",
  "karnataka-2023": "Opening Karnataka",
};

const ROUTE_LABELS: [string, string][] = [
  ["/", "Opening Home"],
  ["/services/research-content", "Opening Research"],
  ["/services", "Opening Services"],
  ["/about", "Opening About"],
  ["/case-studies", "Opening Case Studies"],
  ["/dashboard/case-studies", "Opening Case Studies"],
  ["/dashboard", "Opening Dashboard"],
  ["/account/users", "Opening Users"],
  ["/account/sessions", "Opening Sessions"],
  ["/account/security", "Opening Security"],
  ["/account/password", "Opening Password"],
  ["/login", "Opening Sign in"],
  ["/setup", "Opening Setup"],
];

/** Human label for an internal route. Returns null for unknown or external paths. */
export function routeLabel(pathname: string, explicit?: string | null): string | null {
  if (explicit) return explicit;
  const path = pathname.split("?")[0].split("#")[0] || "/";
  if (path.startsWith("/case-studies/")) {
    const slug = path.slice("/case-studies/".length).split("/")[0];
    return CASE_LABELS[slug] ?? "Opening Case Study";
  }
  if (path === "/case-studies" || path === "/case-studies/") return "Opening Case Studies";
  for (const [route, label] of ROUTE_LABELS) {
    if (path === route || (route !== "/" && path.startsWith(`${route}/`))) return label;
  }
  return "Opening";
}
