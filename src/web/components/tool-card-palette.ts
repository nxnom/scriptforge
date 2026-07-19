const palettes = [
  {
    name: "indigo",
    icon: "bg-[#2c3158] text-[#aeb7ff] ring-[#4a579b]",
    accent: "from-[#5468ff] via-[#7484ff] to-transparent",
    hover: "hover:border-[#4b5795]",
  },
  {
    name: "cyan",
    icon: "bg-[#193c43] text-[#7fd9e8] ring-[#2d6670]",
    accent: "from-[#32b8cc] via-[#56cedd] to-transparent",
    hover: "hover:border-[#326b74]",
  },
  {
    name: "violet",
    icon: "bg-[#382850] text-[#c7a5ff] ring-[#65488c]",
    accent: "from-[#9665e8] via-[#b488f7] to-transparent",
    hover: "hover:border-[#674a8d]",
  },
  {
    name: "rose",
    icon: "bg-[#4a2639] text-[#f3a3ca] ring-[#78405d]",
    accent: "from-[#de6ca4] via-[#ec8dbc] to-transparent",
    hover: "hover:border-[#7b455f]",
  },
  {
    name: "amber",
    icon: "bg-[#49351d] text-[#efbd72] ring-[#73562f]",
    accent: "from-[#d99432] via-[#ecb45d] to-transparent",
    hover: "hover:border-[#765833]",
  },
  {
    name: "green",
    icon: "bg-[#203e31] text-[#8bd7ad] ring-[#35684f]",
    accent: "from-[#46b879] via-[#72ce99] to-transparent",
    hover: "hover:border-[#386a51]",
  },
] as const;

export type ToolPalette = (typeof palettes)[number];

export function paletteFor(value: string): ToolPalette {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return palettes[hash % palettes.length] ?? palettes[0];
}
