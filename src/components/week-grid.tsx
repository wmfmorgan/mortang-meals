import type { DayOfWeek, Meal, MealSlot, WeekPlan } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { MealCard } from "./meal-card";

const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "B",
  lunch: "L",
  dinner: "D",
};

const DAY_HEADINGS: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

function mealAt(
  meals: Meal[],
  day: DayOfWeek,
  slot: MealSlot,
): Meal | undefined {
  return meals.find((meal) => meal.day === day && meal.slot === slot);
}

export function WeekGrid({ plan }: { plan: WeekPlan | null }) {
  const meals = plan?.meals ?? [];

  return (
    <div className="week-grid" role="grid" aria-label="This week">
      <div
        className="week-grid-desktop-label"
        style={{ gridColumn: 1, gridRow: 1 }}
      />
      {DAYS.map((day, dayIndex) => (
        <div
          key={`head-${day}`}
          className="week-grid-desktop-label text-center text-sm font-medium"
          style={{ gridColumn: dayIndex + 2, gridRow: 1 }}
        >
          {DAY_LABELS[day]}
        </div>
      ))}
      {SLOTS.map((slot, slotIndex) => (
        <div
          key={`slot-${slot}`}
          className="week-grid-desktop-label text-sm font-medium"
          style={{ gridColumn: 1, gridRow: slotIndex + 2 }}
        >
          {SLOT_LABELS[slot]}
        </div>
      ))}

      {DAYS.map((day, dayIndex) => (
        <section key={day} className="week-grid-day" aria-label={DAY_HEADINGS[day]}>
          <h2 className="week-grid-day-heading text-sm font-medium">
            {DAY_HEADINGS[day]}
          </h2>
          {SLOTS.map((slot, slotIndex) => {
            const meal = mealAt(meals, day, slot);
            return (
              <div
                key={slot}
                role="gridcell"
                aria-label={
                  meal ? `${day} ${slot}` : `empty ${day} ${slot}`
                }
                className={
                  meal
                    ? "week-cell"
                    : "week-cell week-cell-empty"
                }
                style={{ gridColumn: dayIndex + 2, gridRow: slotIndex + 2 }}
              >
                <span className="week-cell-slot-label">
                  {SLOT_LABELS[slot]}
                </span>
                {meal ? <MealCard meal={meal} /> : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
