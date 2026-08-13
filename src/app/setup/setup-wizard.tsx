"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HouseholdFields,
  householdToDraft,
  type HouseholdDraft,
} from "@/components/household-fields";
import { KitchenChecklist } from "@/components/kitchen-checklist";
import type { DayOfWeek, Household, KitchenItem, MealSlot, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";
import { saveHouseholdAction } from "@/app/household/actions";
import { saveKitchenEnabledStates } from "@/app/kitchen/actions";

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

function defaultSlotMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      { breakfast: false, lunch: false, dinner: true },
    ]),
  ) as SlotMask;
}

export function SetupWizard({
  household,
  kitchen: initialKitchen,
}: {
  household: Household | null;
  kitchen: KitchenItem[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<HouseholdDraft>(() =>
    householdToDraft(household),
  );
  const [kitchen, setKitchen] = useState(initialKitchen);
  const [slotMask, setSlotMask] = useState<SlotMask>(defaultSlotMask);
  const [pending, setPending] = useState(false);

  function toggleKitchen(id: string, enabled: boolean) {
    setKitchen((current) =>
      current.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );
  }

  function toggleSlot(day: DayOfWeek, slot: MealSlot, enabled: boolean) {
    setSlotMask((current) => ({
      ...current,
      [day]: { ...current[day], [slot]: enabled },
    }));
  }

  async function finish() {
    setPending(true);
    try {
      await saveHouseholdAction({
        name: draft.name,
        dietStyle: draft.dietStyle,
        notes: draft.notes,
        servings: draft.servings,
        people: draft.people.map((person) => ({
          name: person.name,
          age: person.age,
          sex: person.sex,
          allergies: person.allergies,
          avoidances: person.avoidances,
        })),
      });
      await saveKitchenEnabledStates(
        kitchen.map((item) => ({ id: item.id, enabled: item.enabled })),
      );
      sessionStorage.setItem("mortang.slotMask", JSON.stringify(slotMask));
      router.push("/");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Setup</h1>
      <p className="text-sm text-zinc-600">Step {step} of 3</p>

      {step === 1 ? (
        <HouseholdFields value={draft} onChange={setDraft} />
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Kitchen</h2>
          <KitchenChecklist items={kitchen} onToggle={toggleKitchen} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Meal slots</h2>
          <div className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-sm font-medium" />
                  {DAYS.map((day) => (
                    <th key={day} className="p-2 text-center text-sm font-medium">
                      {DAY_LABELS[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot) => (
                  <tr key={slot}>
                    <th className="p-2 text-left text-sm font-medium">
                      {SLOT_LABELS[slot]}
                    </th>
                    {DAYS.map((day) => (
                      <td key={day} className="p-2 text-center">
                        <input
                          className="h-5 w-5"
                          type="checkbox"
                          checked={slotMask[day][slot]}
                          aria-label={`${day} ${slot}`}
                          onChange={(event) =>
                            toggleSlot(day, slot, event.target.checked)
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        {step > 1 ? (
          <button
            type="button"
            className="rounded border border-zinc-400 bg-white px-3 py-1"
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </button>
        ) : null}
        {step < 3 ? (
          <button
            type="button"
            className="rounded border border-zinc-400 bg-white px-3 py-1"
            onClick={() => setStep((current) => current + 1)}
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            className="rounded border border-zinc-400 bg-white px-3 py-1"
            disabled={pending}
            onClick={() => {
              void finish();
            }}
          >
            {pending ? "Saving…" : "Finish"}
          </button>
        )}
      </div>
    </div>
  );
}
