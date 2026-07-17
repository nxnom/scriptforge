import { Button } from "@geckoui/geckoui";
import { ArrowLeft, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate();
  return (
    <section className="flex max-w-140 flex-col items-start gap-3 pt-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </Button>
      <div className="grid size-10.5 place-items-center rounded-xl bg-[#2e2e2e]">
        <Wrench size={18} />
      </div>
      <h1 className="m-0">{title}</h1>
      <p className="m-0 text-[#b0b0b0]">{description}</p>
    </section>
  );
}
