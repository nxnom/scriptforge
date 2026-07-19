import { z } from "zod";
import { forgeEfforts, forgeModels } from "../../server/forge/types";

export const modelOptions = [
  { value: "gpt-5.6-sol", label: "GPT-5.6 Sol (default)" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna" },
  { value: "gpt-5.5", label: "GPT-5.5" },
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { value: "gpt-5.3-codex", label: "GPT-5.3 Codex" },
  { value: "gpt-5.2", label: "GPT-5.2" },
] as const;

export const effortOptions = forgeEfforts;

export const forgePreferencesSchema = z.object({
  model: z.enum(forgeModels),
  effort: z.enum(forgeEfforts),
  dangerouslyBypassApprovalsAndSandbox: z.boolean(),
});

export type ForgePreferences = z.infer<typeof forgePreferencesSchema>;

const storageKey = "scriptforge.forge-preferences";
const defaults: ForgePreferences = {
  model: "gpt-5.6-sol",
  effort: "medium",
  dangerouslyBypassApprovalsAndSandbox: false,
};

export function loadForgePreferences(): ForgePreferences {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    const candidate = stored && typeof stored === "object" ? { ...defaults, ...stored } : defaults;
    const parsed = forgePreferencesSchema.safeParse(candidate);
    return parsed.success ? parsed.data : defaults;
  } catch {
    return defaults;
  }
}

export function saveForgePreferences(preferences: ForgePreferences) {
  localStorage.setItem(storageKey, JSON.stringify(preferences));
}
