"use client";

import type { Household, Sex } from "@/lib/types";

export type PersonDraft = {
  key: string;
  name: string;
  age: string;
  sex: "" | Sex;
  allergies: string;
  avoidances: string;
};

export type HouseholdDraft = {
  name: string;
  dietStyle: string;
  notes: string;
  servings: string;
  people: PersonDraft[];
};

const inputClass =
  "mt-1 w-full rounded border border-zinc-300 bg-white px-2 py-1";

export function emptyPerson(key?: string): PersonDraft {
  return {
    key: key ?? crypto.randomUUID(),
    name: "",
    age: "",
    sex: "",
    allergies: "",
    avoidances: "",
  };
}

export function householdToDraft(household: Household | null): HouseholdDraft {
  if (!household) {
    return {
      name: "",
      dietStyle: "",
      notes: "",
      servings: "",
      people: [emptyPerson("initial")],
    };
  }
  return {
    name: household.name,
    dietStyle: household.dietStyle,
    notes: household.notes,
    servings: String(household.servings),
    people:
      household.people.length > 0
        ? household.people.map((person) => ({
            key: person.id,
            name: person.name,
            age: String(person.age),
            sex: person.sex ?? "",
            allergies: person.allergies.join(", "),
            avoidances: person.avoidances.join(", "),
          }))
        : [emptyPerson("initial")],
  };
}

export function HouseholdFields({
  value,
  onChange,
}: {
  value: HouseholdDraft;
  onChange: (next: HouseholdDraft) => void;
}) {
  function update<K extends keyof HouseholdDraft>(
    key: K,
    nextValue: HouseholdDraft[K],
  ) {
    onChange({ ...value, [key]: nextValue });
  }

  function updatePerson(index: number, patch: Partial<PersonDraft>) {
    update(
      "people",
      value.people.map((person, i) =>
        i === index ? { ...person, ...patch } : person,
      ),
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">
        Household name
        <input
          className={inputClass}
          value={value.name}
          onChange={(event) => update("name", event.target.value)}
        />
      </label>
      <label className="block text-sm font-medium">
        Diet style
        <input
          className={inputClass}
          value={value.dietStyle}
          onChange={(event) => update("dietStyle", event.target.value)}
        />
      </label>
      <label className="block text-sm font-medium">
        Notes
        <textarea
          className={inputClass}
          rows={3}
          value={value.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </label>
      <label className="block text-sm font-medium">
        Servings
        <input
          className={inputClass}
          type="number"
          min={1}
          value={value.servings}
          placeholder="defaults to number of people"
          onChange={(event) => update("servings", event.target.value)}
        />
      </label>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">People</h2>
          <button
            type="button"
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
            onClick={() => update("people", [...value.people, emptyPerson()])}
          >
            Add person
          </button>
        </div>
        {value.people.map((person, index) => (
          <fieldset
            key={person.key}
            className="space-y-2 rounded border border-zinc-200 bg-white p-3"
          >
            <legend className="px-1 text-sm font-medium">
              Person {index + 1}
            </legend>
            <label className="block text-sm font-medium">
              Name
              <input
                className={inputClass}
                value={person.name}
                onChange={(event) =>
                  updatePerson(index, { name: event.target.value })
                }
              />
            </label>
            <label className="block text-sm font-medium">
              Age
              <input
                className={inputClass}
                type="number"
                min={0}
                value={person.age}
                onChange={(event) =>
                  updatePerson(index, { age: event.target.value })
                }
              />
            </label>
            <label className="block text-sm font-medium">
              Sex
              <select
                className={inputClass}
                value={person.sex}
                onChange={(event) =>
                  updatePerson(index, {
                    sex: event.target.value as PersonDraft["sex"],
                  })
                }
              >
                <option value=""> </option>
                <option value="male">male</option>
                <option value="female">female</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="block text-sm font-medium">
              Allergies
              <input
                className={inputClass}
                value={person.allergies}
                placeholder="comma-separated"
                onChange={(event) =>
                  updatePerson(index, { allergies: event.target.value })
                }
              />
            </label>
            <label className="block text-sm font-medium">
              Avoidances
              <input
                className={inputClass}
                value={person.avoidances}
                placeholder="comma-separated"
                onChange={(event) =>
                  updatePerson(index, { avoidances: event.target.value })
                }
              />
            </label>
            <button
              type="button"
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm"
              onClick={() =>
                update(
                  "people",
                  value.people.filter((_, i) => i !== index),
                )
              }
            >
              Remove
            </button>
          </fieldset>
        ))}
      </div>
    </div>
  );
}
