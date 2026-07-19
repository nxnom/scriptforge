import { Button } from "@geckoui/geckoui";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function WorkspaceHeader({
  title,
  subtitle,
  actions,
  onBack,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  onBack: () => void;
}) {
  return (
    <header className="h-16 shrink-0 border-[#333] border-b bg-[#1a1a1a] px-10 max-[900px]:px-6 max-[560px]:px-4">
      <div className="mx-auto flex h-full w-full max-w-320 items-center gap-4">
        <Button className="shrink-0" variant="outlined" size="sm" onClick={onBack}>
          <ArrowLeft size={14} /> Library
        </Button>
        <span aria-hidden="true" className="h-7 w-px shrink-0 bg-[#303030]" />
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate font-[Geist_Variable] text-[17px] leading-tight">{title}</h1>
          <p className="mt-0.5 mb-0 truncate text-[10px] text-[#858585]">{subtitle}</p>
        </div>
        {actions && <div className="ml-auto flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>
    </header>
  );
}
