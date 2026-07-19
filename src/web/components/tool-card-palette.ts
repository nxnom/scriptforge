import type { CSSProperties } from "react";

export interface ToolPalette {
  name: string;
  hue: number;
  style: CSSProperties;
}

export function paletteFor(value: string): ToolPalette {
  const hue = hashCategory(value.trim().toLocaleLowerCase()) % 360;

  return {
    name: `hue-${hue}`,
    hue,
    style: {
      "--tool-accent-soft": `oklch(0.76 0.12 ${hue})`,
      "--tool-icon-bg": `oklch(0.29 0.055 ${hue})`,
      "--tool-icon-ring": `oklch(0.53 0.11 ${hue} / 0.75)`,
    } as CSSProperties,
  };
}

function hashCategory(value: string): number {
  let hash = 2_166_136_261;
  for (const character of value || "tool") {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}
