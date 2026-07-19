import { afterEach, describe, expect, it } from "vitest";
import { loadForgePreferences, saveForgePreferences } from "./preferences";

afterEach(() => localStorage.clear());

describe("Forge preferences", () => {
  it("keeps bypass mode off by default", () => {
    expect(loadForgePreferences().dangerouslyBypassApprovalsAndSandbox).toBe(false);
  });

  it("migrates older saved preferences to the safe default", () => {
    localStorage.setItem("scriptforge.forge-preferences", JSON.stringify({ model: "gpt-5.6-sol", effort: "medium" }));

    expect(loadForgePreferences().dangerouslyBypassApprovalsAndSandbox).toBe(false);
  });

  it("remembers an explicit bypass opt-in", () => {
    saveForgePreferences({
      model: "gpt-5.6-sol",
      effort: "medium",
      dangerouslyBypassApprovalsAndSandbox: true,
    });

    expect(loadForgePreferences().dangerouslyBypassApprovalsAndSandbox).toBe(true);
  });
});
