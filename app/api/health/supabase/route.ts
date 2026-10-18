import { NextResponse } from "next/server";

import { checkSupabaseConnection } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await checkSupabaseConnection();

    return NextResponse.json(
      { ok: true, service: "supabase" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ok: false, code: "SUPABASE_CONNECTION_FAILED" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }
}
