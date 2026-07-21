import { RHFController } from "@geckoui/geckoui";
import { useEffect, useMemo, useRef, useState } from "react";

export function VisualChoiceController({
  input,
  prompt,
}: {
  input: { name: string; body: string; options: Array<{ value: string; label: string }> };
  prompt: string;
}) {
  return (
    <RHFController
      name={`answers.${input.name}`}
      render={({ field }) => (
        <VisualChoiceField
          name={input.name}
          prompt={prompt}
          body={input.body}
          options={input.options}
          value={typeof field.value === "string" ? field.value : ""}
          onChange={field.onChange}
        />
      )}
    />
  );
}

function VisualChoiceField({
  name,
  prompt,
  body,
  options,
  value,
  onChange,
}: {
  name: string;
  prompt: string;
  body: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1);
  const allowedValues = useMemo(() => new Set(options.map((option) => option.value)), [options]);
  const document = useMemo(() => visualChoiceDocument(name, body), [body, name]);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow || event.data?.source !== "scriptforge-visual-choice")
        return;
      if (event.data.type === "select" && event.data.name === name && allowedValues.has(event.data.value)) {
        onChange(event.data.value);
      }
      if (event.data.type === "resize" && Number.isFinite(event.data.height)) {
        setHeight(Math.max(1, Math.ceil(event.data.height)));
      }
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [allowedValues, name, onChange]);

  const syncSelection = () => {
    iframeRef.current?.contentWindow?.postMessage(
      { source: "scriptforge-visual-choice-host", type: "selection", name, value },
      "*",
    );
  };
  useEffect(syncSelection, [name, value]);

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[#343434] bg-[#151515]">
      <iframe
        ref={iframeRef}
        title={`${prompt} choices`}
        sandbox="allow-scripts"
        scrolling="no"
        className="block w-full border-0 bg-transparent"
        style={{ height }}
        srcDoc={document}
        onLoad={syncSelection}
      />
      <span className="sr-only" aria-live="polite">
        {selectedLabel ? `Selected: ${selectedLabel}` : "No design selected"}
      </span>
    </div>
  );
}

function visualChoiceDocument(name: string, body: string) {
  const encodedName = JSON.stringify(name);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><script>
(() => {
  const name = ${encodedName};
  const send = (type, detail = {}) => parent.postMessage({ source: "scriptforge-visual-choice", type, name, ...detail }, "*");
  const applySelection = (value) => {
    for (const option of document.querySelectorAll("[data-scriptforge-value]")) {
      const selected = option.getAttribute("data-scriptforge-value") === value;
      option.toggleAttribute("data-scriptforge-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }
    window.dispatchEvent(new CustomEvent("scriptforge:selection", { detail: { value } }));
  };
  window.scriptforgeSelect = (value) => send("select", { value: String(value) });
  addEventListener("message", (event) => {
    if (event.source === parent && event.data?.source === "scriptforge-visual-choice-host" && event.data.name === name) {
      applySelection(event.data.value);
    }
  });
  addEventListener("click", (event) => {
    const option = event.target instanceof Element ? event.target.closest("[data-scriptforge-value]") : null;
    if (option) window.scriptforgeSelect(option.getAttribute("data-scriptforge-value"));
  });
  addEventListener("DOMContentLoaded", () => {
    const reportHeight = () => send("resize", { height: document.documentElement.scrollHeight });
    new ResizeObserver(reportHeight).observe(document.documentElement);
    reportHeight();
  });
})();
</script></head><body>${body}<style>html,body{overflow:hidden!important}[data-scriptforge-value]{box-sizing:border-box}[data-scriptforge-selected]{border-style:solid!important;border-width:4px!important}</style></body></html>`;
}
