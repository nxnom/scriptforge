import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it, vi } from "vitest";
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
    expect(client.getInstructions()).toContain("Only after that standalone check passes");
    expect(client.getInstructions()).toContain("Treat the tester as a narrow utility panel");
    expect(client.getInstructions()).toContain("replace that empty drop zone in the same space");
    expect(client.getInstructions()).toContain("#151515 page background");
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
});
