import { WandSparkles } from "lucide-react";
import { ForgeLaunchButton } from "./ForgeLaunchButton";

export function LibrarySpotlight() {
  return (
    <section className="relative flex shrink-0 items-center justify-between gap-5 overflow-hidden rounded-[18px] bg-[#5468ff] px-6 py-5 max-[620px]:items-start max-[620px]:py-4">
      <WandSparkles
        className="pointer-events-none absolute top-[-34px] right-28 rotate-[-14deg] text-white/10"
        size={150}
      />
      <div className="relative min-w-0">
        <h2 className="m-0 font-[Geist_Variable] text-xl font-semibold text-white max-[620px]:text-lg">
          Need something new? Just describe it.
        </h2>
        <p className="mt-1 mb-0 text-[12px] text-[#e0e4ff] max-[620px]:hidden">
          ScriptForge builds a focused local tool, checks it, and waits for your approval.
        </p>
      </div>
      <ForgeLaunchButton
        className="relative border-white! bg-white! text-[#252945]! hover:bg-[#eef0ff]!"
        idleLabel="Instant build"
      />
    </section>
  );
}
