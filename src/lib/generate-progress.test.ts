import { describe, expect, it } from "vitest";
import { activeStepIndex, progressForPhase } from "./generate-progress";

describe("progressForPhase", () => {
  it("moves forward through generate stages", () => {
    expect(progressForPhase("brief", 1)).toBeLessThan(
      progressForPhase("calling", 1),
    );
    expect(progressForPhase("calling", 1)).toBeLessThan(
      progressForPhase("validating", 1),
    );
    expect(progressForPhase("saving", 1)).toBeLessThan(progressForPhase("done", 1));
    expect(progressForPhase("done", 1)).toBe(100);
  });
});

describe("activeStepIndex", () => {
  it("maps retry onto the checking step", () => {
    expect(activeStepIndex("brief")).toBe(0);
    expect(activeStepIndex("calling")).toBe(1);
    expect(activeStepIndex("retry")).toBe(2);
    expect(activeStepIndex("saving")).toBe(3);
  });
});
