"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GenerationStatus } from "./generation-status";

type NavProps = {
  developerTools: boolean;
  userEmail?: string | null;
};

const LINKS = [
  { href: "/", label: "Plans" },
  { href: "/meals", label: "Meals" },
  { href: "/shopping-list", label: "Shopping list" },
  { href: "/household", label: "Household" },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/settings", label: "Settings" },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navClass(current: boolean) {
  return current
    ? "text-[0.95rem] font-medium text-ink no-underline shadow-[inset_0_-1px_0_0_var(--color-olive)]"
    : "text-[0.95rem] text-herb no-underline hover:text-ink";
}

export function Nav({ developerTools, userEmail }: NavProps) {
  const pathname = usePathname() ?? "/";
  const isLogin = pathname === "/login" || pathname.startsWith("/login/");

  return (
    <header className="no-print sticky top-0 z-50 border-b border-wheat bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] flex-wrap items-center justify-between gap-x-8 gap-y-3 py-3.5">
        <Link
          href={isLogin ? "/login" : "/"}
          className="text-[1.15rem] font-medium tracking-[-0.04em] text-ink no-underline"
        >
          Mortang <span className="text-olive">Meals</span>
        </Link>
        {isLogin ? null : (
          <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {LINKS.map((link) => {
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
              {developerTools ? (
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
                <span className="text-sm text-herb">{userEmail}</span>
                <form action="/logout" method="post">
                  <button
                    type="submit"
                    className="text-[0.95rem] text-herb hover:text-ink"
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
