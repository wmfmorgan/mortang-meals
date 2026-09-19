export function MealImage({
  imageUrl,
  className = "",
  compact = false,
}: {
  imageUrl: string | null | undefined;
  className?: string;
  /** Smaller frame for week-grid cards. */
  compact?: boolean;
}) {
  const frame = compact
    ? "meal-image meal-image-compact"
    : "meal-image meal-image-catalog";

  if (!imageUrl) {
    return (
      <div
        className={`${frame} meal-image-placeholder ${className}`.trim()}
        aria-hidden="true"
      />
    );
  }

  return (
    <div className={`${frame} ${className}`.trim()}>
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary recipe CDNs */}
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        className="meal-image-img"
        onError={(event) => {
          event.currentTarget.style.display = "none";
          event.currentTarget.parentElement?.classList.add(
            "meal-image-placeholder",
          );
        }}
      />
    </div>
  );
}
