import { createAdminClient } from "@/lib/supabase/admin";
import { ConfigTable } from "@/components/config/config-table";
import { Toaster } from "sonner";

export default async function ConfigPage() {
  const supabase = createAdminClient();

  const { data: configs } = await supabase
    .from("system_config")
    .select("key, value, expires_at, updated_at")
    .order("key");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Config</h1>
        <p className="text-muted-foreground mt-1">
          Manage runtime configuration and feature flags
        </p>
      </div>

      <ConfigTable configs={configs ?? []} />
      <Toaster richColors position="bottom-right" theme="dark" />
    </div>
  );
}
