import { Button } from "@geckoui/geckoui";
import { ArrowLeft, Wrench } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  const navigate = useNavigate();
  return (
    <section className="placeholder-page">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </Button>
      <div className="empty-icon">
        <Wrench size={18} />
      </div>
      <h1>{title}</h1>
      <p>{description}</p>
    </section>
  );
}
