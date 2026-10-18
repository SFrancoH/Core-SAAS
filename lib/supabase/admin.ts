import "server-only";

import { createClient } from "@supabase/supabase-js";

let adminClient: ReturnType<typeof createClient> | undefined;

function getRequiredEnvironmentVariable(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient;
  }

  const url = getRequiredEnvironmentVariable("SUPABASE_URL");
  const secretKey = getRequiredEnvironmentVariable("SUPABASE_SECRET_KEY");

  adminClient = createClient(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  return adminClient;
}

export async function checkSupabaseConnection() {
  const url = getRequiredEnvironmentVariable("SUPABASE_URL");
  const secretKey = getRequiredEnvironmentVariable("SUPABASE_SECRET_KEY");
  const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/`, {
    headers: {
      apikey: secretKey
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Supabase connection failed with status ${response.status}`);
  }

  return true;
}
