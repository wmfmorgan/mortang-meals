import { isAdminEmail } from "@/lib/admin";

export function canViewDeveloper(
  developerTools: boolean,
  email?: string | null,
): boolean {
  return developerTools && isAdminEmail(email);
}
