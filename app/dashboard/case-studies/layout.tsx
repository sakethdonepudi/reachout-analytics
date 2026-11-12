import { requirePageSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageSession("/dashboard/case-studies", ["owner"]);
  return children;
}
