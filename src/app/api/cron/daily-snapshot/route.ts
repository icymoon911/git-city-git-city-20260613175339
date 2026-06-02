import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Captures the daily baseline (DAU/WAU/MAU + event participation) so that
// "DAU lift during an event" is computable after the fact. Without this
// running BEFORE an event, the baseline is gone forever.

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  // Capture yesterday (complete day) and today (partial, for live view)
  const { data: yd, error: yErr } = await sb.rpc("capture_daily_snapshot", {
    p_day: new Date(Date.now() - 86_400_000).toISOString().slice(0, 10),
  });
  const { data: td, error: tErr } = await sb.rpc("capture_daily_snapshot", {
    p_day: new Date().toISOString().slice(0, 10),
  });

  if (yErr || tErr) {
    return NextResponse.json({ ok: false, yErr: yErr?.message, tErr: tErr?.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, yesterday: yd, today: td });
}
