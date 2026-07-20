import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("bundled Image Resizer interface", () => {
  it("selects a supported image dropped onto the advertised drop zone", async () => {
    const html = await readFile(resolve("src/tools/bundled/image-resizer/ui.html"), "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const script = parsed.querySelector("script")?.textContent;
    if (!script) throw new Error("Image Resizer script is missing.");
    document.head.innerHTML = parsed.head.innerHTML;
    document.body.innerHTML = parsed.body.innerHTML;
    const createObjectUrl = vi.fn(() => "blob:resizer-test");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    // biome-ignore lint/security/noGlobalEval: The regression test executes the bundled inline UI in an isolated jsdom document.
    window.eval(script);
    const dropZone = document.getElementById("drop");
    const runButton = document.getElementById("run") as HTMLButtonElement | null;
    const fileName = document.getElementById("file-name");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "dropped.png", { type: "image/png" });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { files: [file] } });

    dropZone?.dispatchEvent(drop);

    expect(drop.defaultPrevented).toBe(true);
    expect(createObjectUrl).toHaveBeenCalledWith(file);
    expect(fileName?.textContent).toBe("dropped.png");
    expect(runButton?.disabled).toBe(false);
    expect(dropZone?.style.display).toBe("none");
  });
});
