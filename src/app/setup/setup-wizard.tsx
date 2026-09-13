"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HouseholdFields,
  householdToDraft,
  type HouseholdDraft,
} from "@/components/household-fields";
import { KitchenChecklist } from "@/components/kitchen-checklist";
import { SlotPicker } from "@/components/slot-picker";
import type { Household, KitchenItem, SlotMask } from "@/lib/types";
import { defaultSlotMask, writeSessionMask } from "@/lib/slot-mask";
import { saveHouseholdAction } from "@/app/household/actions";
import {
  saveKitchenEnabledStates,
  seedAndListKitchenAction,
} from "@/app/kitchen/actions";

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
  const [error, setError] = useState<string | null>(null);

  function toggleKitchen(id: string, enabled: boolean) {
    setKitchen((current) =>
      current.map((item) => (item.id === id ? { ...item, enabled } : item)),
    );
  }

  async function saveHouseholdFromDraft() {
    await saveHouseholdAction({
      name: draft.name,
      dietStyle: "",
      notes: draft.notes,
      servings: "",
      people: draft.people.map((person) => ({
        name: person.name,
        age: person.age,
        sex: person.sex,
        allergies: person.allergies,
        avoidances: person.avoidances,
      })),
    });
  }

  async function goNext() {
    setError(null);
    if (step === 1) {
      setPending(true);
      try {
        await saveHouseholdFromDraft();
        const items = await seedAndListKitchenAction();
        setKitchen(items);
        setStep(2);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn’t save household.",
        );
      } finally {
        setPending(false);
      }
      return;
    }
    setStep((current) => current + 1);
  }

  async function finish() {
    setPending(true);
    setError(null);
    try {
      await saveHouseholdFromDraft();
      const items =
        kitchen.length > 0 ? kitchen : await seedAndListKitchenAction();
      if (kitchen.length === 0) setKitchen(items);
      await saveKitchenEnabledStates(
        (kitchen.length > 0 ? kitchen : items).map((item) => ({
          id: item.id,
          enabled: item.enabled,
        })),
      );
      writeSessionMask(slotMask);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t finish setup.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="page-eyebrow">Step {step} of 3</p>
          <h1 className="page-title">Set the table</h1>
          <p className="page-lede">
            Household, kitchen, then which meals you actually want this week.
          </p>
        </div>
      </header>

      {error ? (
        <p role="alert" className="alert">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <HouseholdFields value={draft} onChange={setDraft} />
      ) : null}

      {step === 2 ? (
        <div className="space-y-3">
          <h2 className="text-xl font-medium tracking-[-0.03em]">Kitchen</h2>
          <p className="m-0 text-sm text-herb">
            Turn on the appliances and methods you use. Library generate only
            sees what’s enabled.
          </p>
          {kitchen.length === 0 ? (
            <p className="alert">
              No kitchen items loaded. Go back and continue again, or open
              Kitchen from the nav after finishing setup.
            </p>
          ) : (
            <KitchenChecklist items={kitchen} onToggle={toggleKitchen} />
          )}
        </div>
      ) : null}

      {step === 3 ? <SlotPicker value={slotMask} onChange={setSlotMask} /> : null}

      <div className="flex flex-wrap gap-2">
        {step > 1 ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending}
            onClick={() => setStep((current) => current - 1)}
          >
            Back
          </button>
        ) : null}
        {step < 3 ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => {
              void goNext();
            }}
          >
            {pending && step === 1 ? "Saving…" : "Continue"}
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
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
