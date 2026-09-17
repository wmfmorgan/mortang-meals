import type {
  DayOfWeek,
  ExtraKind,
  Meal,
  MealExtra,
  MealSlot,
  UseIngredient,
  WeekPlan,
  WeekSlot,
} from "@/lib/types";
import { DAYS } from "@/lib/types";
import { defaultSlotMask, visibleWeekSlots } from "@/lib/slot-mask";
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

const SLOT_HEADINGS: Record<WeekSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
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

const SLOT_INDEX: Record<WeekSlot, string> = {
  breakfast: "01",
  lunch: "02",
  dinner: "03",
};

function mealAt(
  meals: Meal[],
  day: DayOfWeek,
  slot: WeekSlot,
): Meal | undefined {
  return meals.find((meal) => meal.day === day && meal.slot === slot);
}

export function WeekGrid({
  plan,
  slotMask,
  onSelectMeal,
  onSelectExtra,
  onChooseExtra,
  onAdd,
  onTakeout,
  onLeftover,
  leftoverFrom = null,
  onPlaceLeftover,
  onReplace: _onReplace,
  editable = false,
  useIngredients = [],
}: {
  plan: WeekPlan | null;
  slotMask?: WeekPlan["slotMask"];
  onSelectMeal?: (meal: Meal) => void;
  onSelectExtra?: (meal: Meal, extra: MealExtra) => void;
  onChooseExtra?: (meal: Meal, kind: ExtraKind) => void;
  onAdd?: (day: DayOfWeek, slot: MealSlot) => void;
  onTakeout?: (day: DayOfWeek, slot: MealSlot) => void;
  onLeftover?: (meal: Meal) => void;
  leftoverFrom?: Meal | null;
  onPlaceLeftover?: (day: DayOfWeek, slot: MealSlot) => void;
  /** Kept for callers; compact week cards open the library via empty cells / flyout. */
  onReplace?: (meal: Meal) => void;
  editable?: boolean;
  useIngredients?: UseIngredient[];
}) {
  const meals = plan?.meals ?? [];
  const slots = visibleWeekSlots(
    slotMask ?? plan?.slotMask ?? defaultSlotMask(),
    meals,
  );

  return (
    <div className="week-grid" role="grid" aria-label="Week plan">
      {DAYS.map((day) => (
        <section
          key={day}
          className="week-grid-day"
          aria-label={DAY_HEADINGS[day]}
        >
          <h2 className="week-grid-day-heading">
            <span className="week-grid-day-short">{DAY_LABELS[day]}</span>
            <span className="week-grid-day-long">{DAY_HEADINGS[day]}</span>
          </h2>
          <div className="week-grid-day-slots">
            {slots.map((slot) => {
              const meal = mealAt(meals, day, slot);
              const tags = useIngredients.filter(
                (item) => item.day === day && item.slot === slot,
              );
              return (
                <div
                  key={slot}
                  role="gridcell"
                  aria-label={
                    meal ? `${day} ${slot}` : `empty ${day} ${slot}`
                  }
                  className={
                    meal
                      ? `week-cell week-cell-${slot}`
                      : `week-cell week-cell-empty week-cell-${slot}`
                  }
                  data-slot={slot}
                >
                  <span className="week-cell-slot-label">
                    <span className="week-cell-slot-index">
                      {SLOT_INDEX[slot]}
                    </span>
                    <span>{SLOT_HEADINGS[slot]}</span>
                  </span>
                  {tags.length > 0 ? (
                    <ul className="use-ingredient-cell-tags">
                      {tags.map((item, index) => (
                        <li key={`${item.name}-${index}`}>{item.name}</li>
                      ))}
                    </ul>
                  ) : null}
                  {meal ? (
                    <MealCard
                      meal={meal}
                      compact
                      onOpen={onSelectMeal}
                      onOpenExtra={
                        onSelectExtra
                          ? (extra) => onSelectExtra(meal, extra)
                          : undefined
                      }
                      onChooseExtra={
                        onChooseExtra
                          ? (kind) => onChooseExtra(meal, kind)
                          : undefined
                      }
                      onLeftover={
                        meal.takeout || meal.leftover ? undefined : onLeftover
                      }
                      editable={editable}
                      canSwap={false}
                    />
                  ) : editable ? (
                    <div className="week-cell-empty-actions">
                      {leftoverFrom && onPlaceLeftover ? (
                        <button
                          type="button"
                          className="week-cell-add"
                          aria-label={`Leftovers ${day} ${slot}`}
                          onClick={() => onPlaceLeftover(day, slot)}
                        >
                          Leftovers
                        </button>
                      ) : null}
                      {onAdd ? (
                        <button
                          type="button"
                          className="week-cell-add"
                          aria-label={`Add ${day} ${slot}`}
                          onClick={() => onAdd(day, slot)}
                        >
                          <span className="week-cell-add-plus" aria-hidden="true">
                            +
                          </span>
                          <span>Add {slot}</span>
                        </button>
                      ) : null}
                      {onTakeout ? (
                        <button
                          type="button"
                          className="week-cell-takeout"
                          aria-label={`Takeout ${day} ${slot}`}
                          onClick={() => onTakeout(day, slot)}
                        >
                          Takeout
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
