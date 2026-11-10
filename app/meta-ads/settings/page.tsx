import { requirePageSession } from "@/lib/require-session";
import { metaConfigured } from "@/lib/meta/oauth";
import MetaSettings from "@/components/meta/meta-settings";

export const dynamic = "force-dynamic";

export default async function MetaSettingsPage() {
  await requirePageSession("/meta-ads/settings", ["owner"]);
  return <MetaSettings metaConfigured={metaConfigured()} />;
}
