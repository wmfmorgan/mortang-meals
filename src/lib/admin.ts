/** Owner-only UI (Settings, Developer). */
export const ADMIN_EMAIL = "wfmorgan73@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}
