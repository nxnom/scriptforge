export const forgeModels = [
  "gpt-5.6-sol",
  "gpt-5.6-terra",
  "gpt-5.6-luna",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.3-codex",
  "gpt-5.2",
] as const;

export const forgeEfforts = ["minimal", "low", "medium", "high", "xhigh"] as const;

export type ForgePreferences = {
  model: (typeof forgeModels)[number];
  effort: (typeof forgeEfforts)[number];
};

export type ForgeServerEvent =
  | { type: "output"; data: string }
  | { type: "exit"; exitCode: number; signal?: number }
  | { type: "error"; message: string };
