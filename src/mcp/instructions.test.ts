import { describe, expect, it } from "vitest";
import { createForgeMcpInstructions } from "./instructions";

describe("Forge MCP instructions", () => {
  it("does not require approval for a clear request", () => {
    const instructions = createForgeMcpInstructions();

    expect(instructions).toContain("If the request is already clear, do not show a kickoff panel or ask for approval");
    expect(instructions).toContain("Do not add an approval block merely to authorize building");
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
});
