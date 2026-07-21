import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
import { doctorInstructions } from "./doctor-server";
import { createForgeMcpServer } from "./server";

describe("ScriptForge MCP server", () => {
  it("advertises its instructions and publishes a validated panel", async () => {
    const publishPanel = vi.fn(async () => undefined);
    const publishCandidate = vi.fn(async () => undefined);
    const server = createForgeMcpServer({ panel: publishPanel, candidate: publishCandidate });
    const client = new Client({ name: "test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    expect(client.getInstructions()).toContain("never infer field names");
    expect(client.getInstructions()).toContain('"requiredExecutables": []');
    expect(client.getInstructions()).toContain("event.source === parent");
    expect(client.getInstructions()).toContain("Write newline-delimited JSON events");
    expect(client.getInstructions()).toContain("You may execute commands, run the candidate");
    expect(client.getInstructions()).toContain("Only after the applicable check above passes");
    expect(client.getInstructions()).toContain("both a 420-620px Forge tester and a much wider installed Tool page");
    expect(client.getInstructions()).toContain("Do not put the whole interface inside a centered max-width wrapper");
    expect(client.getInstructions()).toContain("balanced side-by-side or dashboard layout");
    expect(client.getInstructions()).toContain("main grid or workspace flex: 1 with align-items: stretch");
    expect(client.getInstructions()).toContain("three distinct visual UI directions");
    expect(client.getInstructions()).toContain("one body containing the complete HTML, CSS, and JavaScript chooser");
    expect(client.getInstructions()).toContain("window.scriptforgeSelect(value)");
    expect(client.getInstructions()).toContain("do not default every direction to ScriptForge blue");
    expect(client.getInstructions()).toContain("as if the iframe were 480px wide and again at 1200px");
    expect(client.getInstructions()).toContain("replace that empty drop zone in the same space");
    expect(client.getInstructions()).toContain("#151515 page background");
    expect(client.getInstructions()).toContain("A manual Refresh button alone does not satisfy a live-update request");
    expect(client.getInstructions()).toContain("ask for the refresh interval");
    expect(client.getInstructions()).toContain("Do not silently choose a simpler behavior");
    expect(client.getInstructions()).toContain("Use multi_choice checkboxes");
    expect(client.getInstructions()).toContain("Which currencies should be available?");
    expect(client.getInstructions()).toContain("Set defaultValue to the recommended option or options");
    expect(client.getInstructions()).toContain("request the user's explicit approval");
    expect(client.getInstructions()).toContain("Never install silently");
    expect(client.getInstructions()).not.toContain("run it without asking for permission again");
    expect(client.getInstructions()).toContain("brew info, apt-cache policy, winget show, or npm view");
    expect(client.getInstructions()).toContain("Never assume a package name matches an executable name");
    expect(client.getInstructions()).toContain("The iframe is same-origin, has no sandbox attribute");
    expect(client.getInstructions()).toContain("Tool runners are trusted local Node.js programs");
    expect(client.getInstructions()).toContain("Pin important remote dependencies when practical");
    expect(client.getInstructions()).toContain("text-to-speech belongs to Audio");
    expect(client.getInstructions()).toContain("Accuracy is more important than reuse");
    expect(client.getInstructions()).not.toContain('"categories": ["Files"]');
    expect(client.getInstructions()).not.toContain("Do not test, run, install, or save them");
    await expect(client.listTools()).resolves.toMatchObject({
      tools: expect.arrayContaining([
        expect.objectContaining({ name: "scriptforge_show_panel" }),
        expect.objectContaining({ name: "scriptforge_present_candidate" }),
      ]),
    });
    await client.callTool({
      name: "scriptforge_show_panel",
      arguments: {
        title: "Pick a format",
        blocks: [
          {
            id: "flow",
            type: "diagram",
            format: "mermaid",
            source: "flowchart LR; Input-->Output",
            caption: "What the tool will do",
          },
          {
            id: "format",
            type: "question",
            prompt: "Which format?",
            input: {
              kind: "single_choice",
              name: "format",
              required: true,
              options: [{ value: "png", label: "PNG" }],
            },
          },
        ],
      },
    });

    expect(publishPanel).toHaveBeenCalledWith(expect.objectContaining({ title: "Pick a format" }));

    const untestedCandidate = await client.callTool({
      name: "scriptforge_present_candidate",
      arguments: { summary: "The candidate is ready." },
    });
    expect(untestedCandidate.isError).toBe(true);
    expect(publishCandidate).not.toHaveBeenCalled();

    await client.callTool({
      name: "scriptforge_present_candidate",
      arguments: {
        summary: "The candidate is ready.",
        testSummary: "Processed a realistic sample and verified its output.",
        risks: ["Requires user-provided input"],
      },
    });
    expect(publishCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "The candidate is ready.",
        testSummary: "Processed a realistic sample and verified its output.",
      }),
    );
    await Promise.all([client.close(), server.close()]);
  });

  it("requires Doctor to verify packages and download sources before proposing them", () => {
    expect(doctorInstructions).toContain("brew info, apt-cache policy, winget show, or npm view");
    expect(doctorInstructions).toContain("Never assume a package name matches an executable name");
    expect(doctorInstructions).toContain("confirm the exact URL and pinned version exist");
    expect(doctorInstructions).toContain("Never propose a stale formula");
  });
});
