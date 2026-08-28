import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api/require-staff";

interface CreateAccountBody {
  email?: string;
  displayName?: string;
  password?: string;
}

export async function POST(request: Request) {
  try {
    const staffCheck = await requireStaff();
    if ("error" in staffCheck) return staffCheck.error;

    const body = (await request.json()) as CreateAccountBody;
    const email = body.email?.trim().toLowerCase() ?? "";
    const displayName = body.displayName?.trim() ?? "";
    const password = body.password ?? "";

    if (!email || !displayName || !password) {
      return NextResponse.json(
        { error: "Email, name, and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: authUser, error: createUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createUserError || !authUser.user) {
      const message =
        createUserError?.message.includes("already been registered") ||
        createUserError?.message.includes("already exists")
          ? `An account with email “${email}” already exists.`
          : createUserError?.message ?? "Failed to create auth user.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: account, error: insertError } = await admin
      .from("accounts")
      .insert({
        display_name: displayName,
        email,
        auth_user_id: authUser.user.id,
        role: "Sales Rep",
        is_active: true,
      })
      .select("id, display_name, email, role, is_active, auth_user_id")
      .single();

    if (insertError) {
      await admin.auth.admin.deleteUser(authUser.user.id);
      const message =
        insertError.code === "23505"
          ? `Account name “${displayName}” or email “${email}” already exists.`
          : insertError.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ account });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
