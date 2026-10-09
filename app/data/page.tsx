import { redirect } from "next/navigation";

/** The dataset management UI now lives in the central /admin portal. */
export default function DataRedirect() {
  redirect("/admin");
}
