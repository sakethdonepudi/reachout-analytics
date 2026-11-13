import { redirect } from "next/navigation";
import { requirePageSession } from "@/lib/require-session";

export const dynamic = "force-dynamic";

/** Legacy dataset route. The management UI lives in the owner portal. */
export default async function DataRedirect() {
  const session = await requirePageSession("/data");
  redirect(session.role === "owner" ? "/dashboard/case-studies" : "/case-studies");
}
