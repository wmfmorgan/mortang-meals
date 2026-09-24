import { PageHeader } from "@/components/page-header";
import { safeNextPath } from "@/lib/safe-next-path";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const authError =
    params.error === "confirm"
      ? "Sign-in didn’t finish. Try again with your password or a new email link."
      : null;
  const next = safeNextPath(params.next);

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Sign in"
        lede="Invite-only. Sign in with the email an admin set up for you — password or email link."
      />
      <LoginForm authError={authError} next={next} />
    </div>
  );
}
