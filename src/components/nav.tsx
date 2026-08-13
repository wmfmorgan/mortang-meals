"use client";

import { usePathname } from "next/navigation";

type NavProps = {
  developerTools: boolean;
};

const LINKS = [
  { href: "/", label: "This Week" },
  { href: "/shopping-list", label: "Shopping list" },
  { href: "/household", label: "Household" },
  { href: "/kitchen", label: "Kitchen" },
  { href: "/settings", label: "Settings" },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav({ developerTools }: NavProps) {
  const pathname = usePathname() ?? "/";

  return (
    <header className="sticky top-0 z-20 border-b border-wheat bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex w-[min(1280px,calc(100%-2rem))] flex-wrap items-center justify-between gap-x-8 gap-y-3 py-3.5">
        <a href="/" className="text-[1.15rem] font-medium tracking-[-0.04em] text-ink no-underline">
          Mortang <span className="text-olive">Meals</span>
        </a>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((link) => {
            const current = isCurrent(pathname, link.href);
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={
                  current
                    ? "text-[0.95rem] font-medium text-ink no-underline shadow-[inset_0_-1px_0_0_var(--color-olive)]"
                    : "text-[0.95rem] text-herb no-underline hover:text-ink"
                }
              >
                {link.label}
              </a>
            );
          })}
          {developerTools ? (
            <a
              href="/developer"
              aria-current={pathname === "/developer" ? "page" : undefined}
              className={
                pathname === "/developer"
                  ? "text-[0.95rem] font-medium text-ink no-underline shadow-[inset_0_-1px_0_0_var(--color-olive)]"
                  : "text-[0.95rem] text-herb no-underline hover:text-ink"
              }
            >
              Developer
            </a>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
