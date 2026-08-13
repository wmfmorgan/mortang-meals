"use client";

import { useState, type FormEvent } from "react";
import {
  HouseholdFields,
  householdToDraft,
  type HouseholdDraft,
} from "@/components/household-fields";
import type { Household } from "@/lib/types";
import { saveHouseholdAction } from "./actions";

export function HouseholdForm({ household }: { household: Household | null }) {
  const [draft, setDraft] = useState<HouseholdDraft>(() =>
    householdToDraft(household),
  );
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus(null);
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
    setStatus("Saved.");
  }

  return (
    <form className="max-w-xl space-y-5" onSubmit={onSubmit}>
      <HouseholdFields value={draft} onChange={setDraft} />
      <button type="submit" className="btn btn-primary">
        Save
      </button>
      {status ? <p className="text-sm text-herb">{status}</p> : null}
    </form>
  );
}
