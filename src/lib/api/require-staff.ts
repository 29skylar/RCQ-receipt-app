import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireStaff() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: staffAccount, error: staffError } = await supabase
    .from("accounts")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .eq("is_active", true)
    .single();

  if (staffError || staffAccount?.role !== "Staff") {
    return { error: NextResponse.json({ error: "Only Staff can manage accounts." }, { status: 403 }) };
  }

  return { supabase, user };
}
