import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getGithubLoginFromUser, isAdminGithubLogin } from "@/lib/admin";

// Admin actions on a single event:
//   PATCH { action: "start" | "end" | "cancel" }
//   DELETE → remove a scheduled/archived event

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  const login = getGithubLoginFromUser(user);
  if (!isAdminGithubLogin(login)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { login };
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

  let body: { action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const action = body.action;
  const admin = getSupabaseAdmin();
  const audit = (act: string) =>
    admin.from("event_audit_log").insert({ event_id: id, actor: auth.login ?? "unknown", action: act });

  if (action === "start") {
    const { error } = await admin
      .from("event_instances")
      .update({ status: "live", starts_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("start");
    return NextResponse.json({ ok: true, status: "live" });
  }

  if (action === "end") {
    // Move to wrap; complete_event_wrap computes total/outcome/ranks/rewards.
    await admin
      .from("event_instances")
      .update({ status: "wrap", ends_at: new Date().toISOString() })
      .eq("id", id);
    const { error } = await admin.rpc("complete_event_wrap", { p_event_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("end");
    return NextResponse.json({ ok: true, status: "archived" });
  }

  if (action === "cancel") {
    const { error } = await admin
      .from("event_instances")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit("cancel");
    return NextResponse.json({ ok: true, status: "archived" });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { id } = await ctx.params;

  const admin = getSupabaseAdmin();
  // Only allow deleting non-live events
  const { error } = await admin
    .from("event_instances")
    .delete()
    .eq("id", id)
    .neq("status", "live");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
