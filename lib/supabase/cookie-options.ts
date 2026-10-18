type CookieConfig = {
  domain?: string; expires?: Date; maxAge?: number;
  path?: string; priority?: "low" | "medium" | "high";
  httpOnly?: boolean; secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  partitioned?: boolean;
};
export function getAuthCookieOptions(options: CookieConfig = {}): CookieConfig {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    ...options,
    path: "/",
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    ...(isProduction ? { partitioned: true } : {})
  };
}
