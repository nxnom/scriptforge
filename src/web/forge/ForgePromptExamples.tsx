import { Button, Menu, MenuTrigger, Tooltip, toast, useMenu } from "@geckoui/geckoui";
import { CalendarDays, CircleHelp, Clock3, Copy, Palette } from "lucide-react";

const promptExamples = [
  {
    title: "Time-zone planner",
    description: "Compare cities and working hours",
    icon: Clock3,
    prompt:
      "Forge a time-zone planner where I can select a date and time, compare it across up to four cities, highlight overlapping working hours, and copy the converted times.",
  },
  {
    title: "Color mixer",
    description: "Explore three UI and palette directions",
    icon: Palette,
    prompt:
      "Forge a color mixer where I can choose two colors, adjust their mixing ratio, see the result in HEX, RGB, and HSL, generate lighter and darker variations, and check contrast against white and black. Before building it, show me three distinct UI designs with different layouts, visual styles, and color palettes. Include a visual preview of each and let me choose one.",
  },
  {
    title: "Date calculator",
    description: "Calculate dates, durations, and weekdays",
    icon: CalendarDays,
    prompt:
      "Forge a date calculator that adds or subtracts days, weeks, or months from a selected date, calculates the duration between two dates, optionally excludes weekends, and keeps a copyable calculation history.",
  },
] as const;

export function ForgePromptExamples() {
  const copyPrompt = async (title: string, prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(`${title} prompt copied.`);
    } catch {
      toast.error("The prompt could not be copied.");
    }
  };

  return (
    <Menu
      placement="bottom-end"
      menuClassName="max-h-[min(70vh,34rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto p-2"
    >
      <MenuTrigger>
        {({ toggleMenu }) => (
          <Tooltip content="Example prompts" triggerAsChild>
            <Button
              type="button"
              size="xs"
              variant="icon"
              aria-label="Example prompts"
              className="size-6 text-[#8f8f8f]"
              onClick={toggleMenu}
            >
              <CircleHelp size={14} />
            </Button>
          </Tooltip>
        )}
      </MenuTrigger>
      {promptExamples.map((example) => (
        <PromptExampleCard example={example} key={example.title} onCopy={copyPrompt} />
      ))}
    </Menu>
  );
}

function PromptExampleCard({
  example,
  onCopy,
}: {
  example: (typeof promptExamples)[number];
  onCopy: (title: string, prompt: string) => Promise<void>;
}) {
  const { closeMenu } = useMenu();
  const Icon = example.icon;
  const copy = () => {
    closeMenu();
    void onCopy(example.title, example.prompt);
  };

  return (
    <fieldset
      aria-label={example.title}
      className="m-0 grid min-w-0 gap-2 rounded-lg border border-[#383838] bg-[#202020] p-3 not-last:mb-2"
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 shrink-0 text-[#8795ff]" size={14} />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="font-medium text-[#dedede] text-xs">{example.title}</span>
          <span className="font-normal text-[#858585] text-[10px] leading-4">{example.description}</span>
        </div>
        <Button
          type="button"
          role="menuitem"
          size="xs"
          variant="outlined"
          aria-label={`Copy ${example.title} prompt`}
          className="shrink-0 gap-1.5"
          onClick={copy}
        >
          <Copy size={11} /> Copy
        </Button>
      </div>
      <p className="m-0 text-[#b4b4b4] text-[11px] leading-4.5">{example.prompt}</p>
    </fieldset>
  );
}
