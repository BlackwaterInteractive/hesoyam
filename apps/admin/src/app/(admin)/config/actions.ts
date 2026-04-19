"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function upsertConfig(
  key: string,
  value: string,
  expiresAt?: string
): Promise<{ success: boolean; error?: string }> {
  if (!key.trim()) {
    return { success: false, error: "Key is required" };
  }

  let parsedValue: import("@/lib/types").Json;
  try {
    parsedValue = JSON.parse(value) as import("@/lib/types").Json;
  } catch {
    return { success: false, error: "Value must be valid JSON" };
  }

  const supabase = createAdminClient();

  const { error } = await supabase.from("system_config").upsert(
    {
      key: key.trim(),
      value: parsedValue,
      expires_at: expiresAt?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/config");
  return { success: true };
}

export async function deleteConfig(
  key: string
): Promise<{ success: boolean; error?: string }> {
  if (!key.trim()) {
    return { success: false, error: "Key is required" };
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from("system_config")
    .delete()
    .eq("key", key);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/config");
  return { success: true };
}
