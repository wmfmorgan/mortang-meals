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
      ? "That sign-in link didn’t finish. Request a new one."
      : null;
  const next = safeNextPath(params.next);

  return (
    <div className="mx-auto max-w-md">
      <div className="surface p-6 sm:p-8">
        <LoginForm authError={authError} next={next} />
      </div>
      <p className="mt-4 text-center text-sm text-herb">
        This household is invite-only.
      </p>
    </div>
  );
}
