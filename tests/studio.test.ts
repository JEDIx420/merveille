import { describe, it, expect } from "vitest";
import {
  validateRule,
  nextWeekly,
  ruleTemplates,
  ruleSentence,
} from "../src/shared/studio/definitions";
describe("closed studio rules", () => {
  it("accepts templates and provides human readable summaries", () => {
    for (const t of ruleTemplates) {
      expect(validateRule(t.definition)).toEqual(t.definition);
      expect(ruleSentence(t.definition).length).toBeGreaterThan(20);
    }
  });
  it.each(["WEBHOOK", "RELEASE_DRAWING", "CONFIRM_PAYMENT", "EXECUTE_SQL"])(
    "rejects unsupported action %s",
    (type) => {
      expect(() =>
        validateRule({
          ...ruleTemplates[0].definition,
          actions: [{ type, title: "Action", dueDays: 0 }],
        }),
      ).toThrow();
    },
  );
  it("rejects excessive actions, dates, nested and unknown model fields", () => {
    const d = ruleTemplates[0].definition;
    for (const value of [
      { ...d, script: "anything" },
      { ...d, actions: Array(4).fill(d.actions[0]) },
      { ...d, weekday: 7 },
      { ...d, actions: [{ ...d.actions[0], dueDays: 91 }] },
      { ...d, condition: { sql: "true" } },
    ])
      expect(() => validateRule(value)).toThrow();
  });
  it("does not allow task labels on schedule/drawing events", () => {
    expect(() =>
      validateRule({
        ...ruleTemplates[0].definition,
        actions: [
          { type: "LABEL", title: "Label", label: "Coordination", dueDays: 0 },
        ],
      }),
    ).toThrow();
  });
  it("schedules Monday 9am in IST and rolls over after the slot", () => {
    const d = ruleTemplates[0].definition;
    expect(
      new Date(nextWeekly(d, Date.parse("2026-11-29T20:00:00Z"))).toISOString(),
    ).toBe("2026-11-30T03:30:00.000Z");
    expect(
      new Date(nextWeekly(d, Date.parse("2026-11-30T03:30:00Z"))).toISOString(),
    ).toBe("2026-12-07T03:30:00.000Z");
  });
});
