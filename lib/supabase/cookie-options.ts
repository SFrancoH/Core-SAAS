// @ts-nocheck — compatibilidad PETS pendiente de tipado completo.
export function getAuthCookieOptions(options = {}) {
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
