"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction } from "@/app/household/actions";

export function JoinForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoTried = useRef(false);

  async function accept(trimmed: string) {
    setError(null);
    if (!trimmed) {
      setError("Enter an invite code.");
      return;
    }
    setPending(true);
    try {
      const result = await acceptInviteAction(trimmed);
      if (!result.ok) {
        setError(result.error);
        setPending(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t accept invite.");
      setPending(false);
    }
  }

  useEffect(() => {
    const trimmed = initialCode.trim().toUpperCase();
    if (!trimmed || autoTried.current) return;
    autoTried.current = true;
    void accept(trimmed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount for ?code=
  }, [initialCode]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await accept(code.trim());
  }

  return (
    <form
      className="mx-auto max-w-md space-y-4"
      onSubmit={(event) => void onSubmit(event)}
    >
      <label className="field">
        Invite code
        <input
          className="input font-mono tracking-wider uppercase"
          name="code"
          autoComplete="off"
          spellCheck={false}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="ABCD2345"
        />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Joining…" : "Accept invite"}
      </button>
      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
