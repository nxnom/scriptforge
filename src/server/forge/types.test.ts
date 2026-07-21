import { describe, expect, it } from "vitest";
import { forgePanelRequestSchema } from "./types";

describe("Forge panel question defaults", () => {
  it("accepts recommended checkbox defaults that match option values", () => {
    expect(forgePanelRequestSchema.safeParse(currencyPanel(["USD", "THB"])).success).toBe(true);
  });

  it("rejects a default that is not one of the offered choices", () => {
    const result = forgePanelRequestSchema.safeParse(currencyPanel(["JPY"]));
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toContain("match an option value");
  });

  it("accepts selectable visual choices with an HTML preview per option", () => {
    const result = forgePanelRequestSchema.safeParse({
      title: "Choose a design",
      blocks: [
        {
          id: "design",
          type: "question",
          prompt: "Which direction should I build?",
          input: {
            kind: "visual_choice",
            name: "design",
            required: true,
            options: [
              { value: "default", label: "ScriptForge dark" },
              { value: "warm", label: "Warm studio" },
            ],
            body: '<button data-scriptforge-value="default">Dark dashboard</button><button data-scriptforge-value="warm">Warm workspace</button>',
            defaultValue: "default",
          },
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

function currencyPanel(defaultValue: string[]) {
  return {
    title: "Choose currencies",
    blocks: [
      {
        id: "currencies",
        type: "question",
        prompt: "Which currencies should be available?",
        input: {
          kind: "multi_choice",
          name: "currencies",
          required: true,
          options: [
            { value: "USD", label: "USD" },
            { value: "THB", label: "THB" },
          ],
          defaultValue,
        },
      },
    ],
  };
}
