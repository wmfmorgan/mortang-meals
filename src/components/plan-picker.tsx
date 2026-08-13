type PlanOption = {
  id: string;
  weekStart: string;
  isCurrent: boolean;
};

export function PlanPicker({
  plans,
  selectedId,
  hrefFor,
}: {
  plans: PlanOption[];
  selectedId?: string;
  hrefFor: (id: string) => string;
}) {
  if (plans.length === 0) return null;

  return (
    <ul className="plan-picker">
      {plans.map((item) => {
        const selected = item.id === selectedId;
        return (
          <li key={item.id} className="flex items-center gap-2">
            <a
              href={hrefFor(item.id)}
              aria-current={selected ? "page" : undefined}
            >
              {item.weekStart}
            </a>
            {item.isCurrent ? <span className="badge">current</span> : null}
          </li>
        );
      })}
    </ul>
  );
}
