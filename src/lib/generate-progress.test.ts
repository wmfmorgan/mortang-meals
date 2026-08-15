import { describe, expect, it } from "vitest";
import { activeStepIndex, progressForPhase, stepStatus } from "./generate-progress";

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

  it("moves forward through import stages", () => {
    expect(progressForPhase("opening", 1)).toBeLessThan(
      progressForPhase("writing", 1),
    );
    expect(progressForPhase("writing", 1)).toBeLessThan(
      progressForPhase("saving", 1),
    );
  });
});

describe("activeStepIndex", () => {
  it("maps retry onto the checking step", () => {
    expect(activeStepIndex("brief")).toBe(0);
    expect(activeStepIndex("calling")).toBe(1);
    expect(activeStepIndex("retry")).toBe(2);
    expect(activeStepIndex("saving")).toBe(3);
  });

  it("treats a finished generate as past the last step", () => {
    expect(activeStepIndex("done")).toBe(4);
  });

  it("maps import phases onto three steps", () => {
    expect(activeStepIndex("opening", "import")).toBe(0);
    expect(activeStepIndex("writing", "import")).toBe(1);
    expect(activeStepIndex("saving", "import")).toBe(2);
    expect(activeStepIndex("done", "import")).toBe(3);
  });
});

describe("stepStatus", () => {
  it("marks saving complete when the week is ready", () => {
    expect(stepStatus(3, "done", "success")).toBe("done");
    expect(stepStatus(3, "saving", "running")).toBe("current");
    expect(stepStatus(2, "saving", "running")).toBe("done");
    expect(stepStatus(0, "calling", "running")).toBe("done");
  });
});
