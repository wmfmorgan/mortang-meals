import { redirect } from "next/navigation";
import { resolveConfirmAuth } from "@/app/auth/confirm/confirm-params";
import { safeNextPath } from "@/lib/safe-next-path";

function failPath(next: string): string {
  return next !== "/"
    ? `/login?error=confirm&next=${encodeURIComponent(next)}`
    : "/login?error=confirm";
}

export default async function CallbackPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    code?: string;
    next?: string;
  }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(params.next ?? null) ?? "/";
  const query = new URLSearchParams();
  if (params.token_hash) query.set("token_hash", params.token_hash);
  if (params.type) query.set("type", params.type);
  if (params.code) query.set("code", params.code);
  const auth = resolveConfirmAuth(query);

  if (auth.kind === "invalid" || auth.kind === "implicit") {
    redirect(failPath(next));
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="surface p-6 sm:p-8">
        <h1 className="font-display text-[1.75rem] font-bold tracking-tight">
          Finish signing in
        </h1>
        <p className="mt-2 text-[0.95rem] leading-relaxed text-herb">
          Confirm this is you to complete the sign-in link. Email apps often
          open the link before you do; this last click keeps the one-time
          token for you.
        </p>
        <form
          className="mt-5"
          action="/auth/callback/complete"
          method="post"
        >
          {auth.kind === "token" ? (
            <>
              <input type="hidden" name="token_hash" value={auth.token_hash} />
              <input type="hidden" name="type" value={auth.type} />
            </>
          ) : (
            <input type="hidden" name="code" value={auth.code} />
          )}
          {next !== "/" ? (
            <input type="hidden" name="next" value={next} />
          ) : null}
          <button type="submit" className="btn btn-primary w-full">
            Continue signing in
          </button>
        </form>
      </div>
    </div>
  );
}
