// @ts-nocheck — compatibilidad PETS pendiente de tipado completo.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { getAuthCookieOptions } from "@/lib/supabase/cookie-options";

export async function refreshSupabaseSession(request) {
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return response;
  }

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, getAuthCookieOptions(options));
        });
      }
    }
  });

  await supabase.auth.getUser();
  return response;
}
