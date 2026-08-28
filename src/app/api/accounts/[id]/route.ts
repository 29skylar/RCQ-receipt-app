import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api/require-staff";

interface UpdateAccountBody {
  displayName?: string;
  email?: string;
  password?: string;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const staffCheck = await requireStaff();
    if ("error" in staffCheck) return staffCheck.error;

    const { id } = await params;
    const body = (await request.json()) as UpdateAccountBody;
    const displayName = body.displayName?.trim() ?? "";
    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password?.trim() ?? "";

    if (!displayName || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existing, error: fetchError } = await admin
      .from("accounts")
      .select("id, display_name, email, auth_user_id, role, is_active")
      .eq("id", id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (existing.role !== "Sales Rep") {
      return NextResponse.json({ error: "Only sales rep accounts can be edited here." }, { status: 400 });
    }

    if (!existing.auth_user_id) {
      return NextResponse.json(
        { error: "This account is not linked to a login. Re-run the auth seed script or recreate it." },
        { status: 400 },
      );
    }

    const authUpdates: { email?: string; password?: string } = {};
    if (email !== (existing.email ?? "")) {
      authUpdates.email = email;
    }
    if (password) {
      authUpdates.password = password;
    }

    if (Object.keys(authUpdates).length > 0) {
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(
        existing.auth_user_id,
        authUpdates,
      );

      if (authUpdateError) {
        const message =
          authUpdateError.message.includes("already been registered") ||
          authUpdateError.message.includes("already exists")
            ? `An account with email “${email}” already exists.`
            : authUpdateError.message;
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    const { data: account, error: updateError } = await admin
      .from("accounts")
      .update({
        display_name: displayName,
        email,
      })
      .eq("id", id)
      .select("id, display_name, email, role, is_active, auth_user_id")
      .single();

    if (updateError) {
      const message =
        updateError.code === "23505"
          ? `Account name “${displayName}” or email “${email}” already exists.`
          : updateError.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (displayName !== existing.display_name) {
      const { error: recordsError } = await admin
        .from("client_records")
        .update({ owner_display_name: displayName })
        .eq("owner_account_id", id);

      if (recordsError) {
        return NextResponse.json(
          { error: `Account updated but client records could not be synced: ${recordsError.message}` },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
