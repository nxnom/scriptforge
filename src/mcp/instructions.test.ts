import { describe, expect, it } from "vitest";
import { createForgeMcpInstructions } from "./instructions";

describe("Forge MCP instructions", () => {
  it("does not require approval for a clear request", () => {
    const instructions = createForgeMcpInstructions();

    expect(instructions).toContain("If the functional request is already clear, do not ask extra kickoff questions");
    expect(instructions).toContain("Do not add an approval block merely to authorize building");
  });

  it("always offers three visual directions before building a new tool", () => {
    const instructions = createForgeMcpInstructions();

    expect(instructions).toContain("always call scriptforge_show_panel with three distinct visual UI directions");
    expect(instructions).toContain("a required visual_choice question");
    expect(instructions).toContain("one body containing the complete HTML, CSS, and JavaScript chooser");
    expect(instructions).toContain('data-scriptforge-value="<matching option value>"');
    expect(instructions).toContain("window.scriptforgeSelect(value)");
    expect(instructions).toContain("ScriptForge does not wrap the choices in host-designed cards or columns");
    expect(instructions).toContain("Direction 1 is the recommended default");
    expect(instructions).toContain("#5468ff primary accents");
    expect(instructions).toContain("Tailor Directions 2 and 3 to the tool's purpose");
  });

  it("does not rerun the standalone tool for a UI-only revision", () => {
    const instructions = createForgeMcpInstructions();

    expect(instructions).toContain("If only ui.html changed after a successful standalone runner check");
    expect(instructions).toContain("without rerunning run.mjs");
    expect(instructions).toContain("applicable runner or UI-only check");
    expect(instructions).toContain("Preview is available for the user's optional review");
  });

  it("requires a custom browser for tools that operate on folders", () => {
    const instructions = createForgeMcpInstructions();

    expect(instructions).toContain(
      "Provide manual absolute-path entry plus a visible Add folder or Choose folder action",
    );
    expect(instructions).toContain('{ action: "browseFolders", path, showHidden }');
    expect(instructions).toContain("Close, Up, an editable current-path field with Go");
    expect(instructions).toContain("do not leave the user with only a pasted-path field");
    expect(instructions).toContain(
      "Folder browsing itself must never perform the tool's destructive or mutating action",
    );
  });

  it("requires advertised drag and drop to accept real files", () => {
    const instructions = createForgeMcpInstructions();

    expect(instructions).toContain("never write “drag and drop,” “drop files,” or equivalent copy");
    expect(instructions).toContain("reads dataTransfer.files");
    expect(instructions).toContain("handle dragenter, dragover, dragleave, and drop");
    expect(instructions).toContain("dispatch or manually perform a real file drop");
    expect(instructions).toContain("Do not add “drop” copy or styling without functional drop handling");
  });

  it("requires wide tool layouts to stretch their primary cards", () => {
    const instructions = createForgeMcpInstructions();

    expect(instructions).toContain("do not leave the primary input and result cards at content height");
    expect(instructions).toContain("main grid or workspace flex: 1 with align-items: stretch");
    expect(instructions).toContain("return the main layout and cards to height: auto");
    expect(instructions).toContain("ending above a large blank lower area");
  });
});
