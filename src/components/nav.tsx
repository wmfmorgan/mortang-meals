"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isAdminEmail } from "@/lib/admin";
import { GenerationStatus } from "./generation-status";

type NavProps = {
  developerTools: boolean;
  userEmail?: string | null;
};

const BASE_LINKS = [
  { href: "/", label: "Plans" },
  { href: "/meals", label: "Meals" },
  { href: "/shopping-list", label: "Shopping list" },
  { href: "/household", label: "Household" },
  { href: "/kitchen", label: "Kitchen" },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navClass(current: boolean) {
  return current
    ? "rounded-lg bg-paper px-3 py-1.5 text-[0.8125rem] font-semibold text-primary no-underline shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
    : "rounded-lg px-3 py-1.5 text-[0.8125rem] text-herb no-underline hover:bg-paper/70 hover:text-ink";
}

export function Nav({ developerTools, userEmail }: NavProps) {
  const pathname = usePathname() ?? "/";
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");
  const admin = isAdminEmail(userEmail);
  const links = admin
    ? [...BASE_LINKS, { href: "/settings", label: "Settings" } as const]
    : [...BASE_LINKS];

  return (
    <header className="no-print sticky top-0 z-50 border-b border-wheat bg-paper">
      <div className="mx-auto flex h-16 w-[min(1360px,calc(100%-2rem))] flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <Link
          href={isLogin ? "/login" : "/"}
          className="font-display text-[1.25rem] font-bold tracking-tight text-primary no-underline"
        >
          Mortang Meals
        </Link>
        {isLogin ? null : (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-wheat/60 bg-surface-low p-1">
              {links.map((link) => {
                const current = isCurrent(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={navClass(current)}
                  >
                    {link.label}
                  </Link>
                );
              })}
              {admin && developerTools ? (
                <Link
                  href="/developer"
                  aria-current={pathname === "/developer" ? "page" : undefined}
                  className={navClass(pathname === "/developer")}
                >
                  Developer
                </Link>
              ) : null}
            </nav>
            <GenerationStatus />
            {userEmail ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-[0.65rem] font-medium tracking-wide text-herb">
                  {userEmail}
                </span>
                <form action="/logout" method="post">
                  <button
                    type="submit"
                    className="text-[0.8125rem] text-herb hover:text-ink"
                  >
                    Log out
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
}
