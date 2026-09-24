import { describe, expect, it } from "vitest";
import { stepChipTitle } from "./step-title";

describe("stepChipTitle", () => {
  it("numbers the first five words of a step", () => {
    expect(
      stepChipTitle(
        "Lay the seasoned wild salmon fillets skin-side down onto the pan",
        0,
      ),
    ).toBe("1. Lay the seasoned wild salmon");
  });

  it("uses Step when the text is empty", () => {
    expect(stepChipTitle("", 0)).toBe("1. Step");
  });

  it("uses Step when the text is only whitespace", () => {
    expect(stepChipTitle("   ", 2)).toBe("3. Step");
  });
});
