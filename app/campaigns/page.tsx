import { redirect } from "next/navigation";
import { roleHome } from "@/lib/access";
import { requirePageSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await requirePageSession("/campaigns", ["owner", "client"]);
  redirect(session.role === "owner" ? "/dashboard" : "/case-studies");
}
