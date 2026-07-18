import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShadowHtmlBlock } from "./ShadowHtmlBlock";

describe("ShadowHtmlBlock", () => {
  it("isolates CSS and strips active or remote content", () => {
    const { container } = render(
      <ShadowHtmlBlock
        body={
          '<style>.card{color:red;background:url(https://bad.test/x)}</style><div class="card" onclick="steal()"><script>steal()</script><img src="https://bad.test/x">Safe</div>'
        }
      />,
    );
    const shadow = container.firstElementChild?.shadowRoot;

    expect(shadow).not.toBeNull();
    expect(shadow?.textContent).toContain("Safe");
    expect(shadow?.querySelector("script")).toBeNull();
    expect(shadow?.querySelector("[onclick]")).toBeNull();
    expect(shadow?.querySelector("img")?.hasAttribute("src")).toBe(false);
    expect(shadow?.innerHTML).not.toContain("https://bad.test");
  });
});
