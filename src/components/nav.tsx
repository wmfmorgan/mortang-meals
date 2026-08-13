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

export function Nav({ developerTools }: NavProps) {
  return (
    <nav className="flex flex-wrap gap-4 border-b border-zinc-300 bg-white px-4 py-3">
      {LINKS.map((link) => (
        <a key={link.href} href={link.href} className="text-blue-700 underline">
          {link.label}
        </a>
      ))}
      {developerTools ? (
        <a href="/developer" className="text-blue-700 underline">
          Developer
        </a>
      ) : null}
    </nav>
  );
}
