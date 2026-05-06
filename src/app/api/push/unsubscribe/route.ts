import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) {
    return NextResponse.json({ ok: false, error: "no-token" }, { status: 401 });
  }
  const admin = getSupabaseAdmin();
  const { data: userData, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !userData.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const userId = userData.user.id;

  let body: { endpoint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  if (!body.endpoint) {
    return NextResponse.json(
      { ok: false, error: "missing-endpoint" },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("endpoint", body.endpoint);
  if (error) {
    console.error("[push unsubscribe] delete error", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
