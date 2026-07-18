import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

export function MermaidBlock({ id, source, caption }: { id: string; source: string; caption?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
          mermaidInitialized = true;
        }
        const { svg } = await mermaid.render(`scriptforge-mermaid-${id}`, source);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(undefined);
        }
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "The diagram could not be rendered.");
      }
    };
    void render();
    return () => {
      cancelled = true;
    };
  }, [id, source]);

  if (error) {
    return (
      <div className="grid gap-2 rounded-xl border border-[#6d3c39] bg-[#2b1d1c] p-3">
        <div className="flex items-center gap-1.5 text-[#dd8179] text-xs">
          <AlertTriangle size={13} /> Diagram could not be displayed
        </div>
        <pre className="m-0 overflow-x-auto whitespace-pre font-mono text-[11px] text-[#aaa]">{source}</pre>
      </div>
    );
  }

  return (
    <figure className="m-0 grid gap-2">
      <div
        ref={containerRef}
        className="overflow-x-auto rounded-xl border border-[#333] bg-[#181818] p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      />
      {caption && <figcaption className="text-center text-[10px] text-[#888]">{caption}</figcaption>}
    </figure>
  );
}
