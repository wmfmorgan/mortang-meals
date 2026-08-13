import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  lede,
  action,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {lede ? <p className="page-lede">{lede}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </header>
  );
}
