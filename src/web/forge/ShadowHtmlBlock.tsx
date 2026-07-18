import { useEffect, useRef } from "react";
import panelContentCss from "./panel-content.css?inline";

export function ShadowHtmlBlock({ body }: { body: string }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>${panelContentCss}</style><div class="scriptforge-panel-html">${sanitize(body)}</div>`;
  }, [body]);

  return <div ref={hostRef} className="max-w-full overflow-x-auto" />;
}

function sanitize(body: string) {
  const document = new DOMParser().parseFromString(body, "text/html");
  for (const element of document.querySelectorAll("script, iframe, object, embed, link, meta, base")) element.remove();
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim().toLowerCase();
      if (
        name.startsWith("on") ||
        name === "srcdoc" ||
        ((name === "href" || name === "src") && value.startsWith("javascript:"))
      ) {
        element.removeAttribute(attribute.name);
      }
      if ((name === "src" || name === "poster") && /^(https?:)?\/\//.test(value))
        element.removeAttribute(attribute.name);
    }
  }
  for (const style of document.querySelectorAll("style")) {
    style.textContent = style.textContent?.replace(/@import[^;]+;?/gi, "").replace(/url\([^)]*\)/gi, "none") ?? "";
  }
  const headStyles = [...document.head.querySelectorAll("style")].map((style) => style.outerHTML).join("");
  return `${headStyles}${document.body.innerHTML}`;
}
