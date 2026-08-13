import { describe, expect, it } from "vitest";
import { normalizePeople } from "./normalize-people";

describe("normalizePeople", () => {
  it("keeps named people and drops blank or whitespace-only rows", () => {
    expect(
      normalizePeople([
        {
          name: "  Alex  ",
          age: "40",
          sex: "male",
          allergies: "shrimp, peanuts",
          avoidances: " cilantro ",
        },
        {
          name: "",
          age: "0",
          sex: "",
          allergies: "",
          avoidances: "",
        },
        {
          name: "   ",
          age: "12",
          sex: "female",
          allergies: "dairy",
          avoidances: "",
        },
      ]),
    ).toEqual([
      {
        name: "Alex",
        age: 40,
        sex: "male",
        allergies: ["shrimp", "peanuts"],
        avoidances: ["cilantro"],
      },
    ]);
  });

  it("returns an empty list when every row is unnamed", () => {
    expect(
      normalizePeople([
        { name: "", age: "0", sex: "", allergies: "", avoidances: "" },
        { name: "  ", age: "8", sex: "other", allergies: "", avoidances: "" },
      ]),
    ).toEqual([]);
  });
});
