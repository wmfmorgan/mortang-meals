import { PageHeader } from "@/components/page-header";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const authError =
    params.error === "confirm"
      ? "Sign-in didn’t finish. Enter your email and password again."
      : null;

  return (
    <div>
      <PageHeader
        eyebrow="Account"
        title="Sign in"
        lede="Invite-only. Use the email and password an admin set up for you."
      />
      <LoginForm authError={authError} />
    </div>
  );
}
