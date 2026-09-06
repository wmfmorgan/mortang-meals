"use client";

export function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange?: (stars: number) => void;
}) {
  return (
    <div className="star-rating" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="star-rating-btn"
          aria-pressed={value >= star}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          disabled={!onChange}
          onClick={() => onChange?.(value === star ? 0 : star)}
        >
          {value >= star ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}
