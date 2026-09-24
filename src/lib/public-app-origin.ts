/**
 * Origin used for auth email redirects (magic link).
 * Prefer NEXT_PUBLIC_SITE_URL so preview / *.vercel.app hosts do not bake a
 * redirect_to that is missing from the Supabase allowlist.
 */
export function publicAppOrigin(fallbackOrigin?: string): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/$/, "");
  return "";
}
