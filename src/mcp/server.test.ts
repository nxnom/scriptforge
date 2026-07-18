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
    await expect(client.listResourceTemplates()).resolves.toMatchObject({
      resourceTemplates: [expect.objectContaining({ uriTemplate: "scriptforge://authoring/{document}" })],
    });
    await expect(client.readResource({ uri: "scriptforge://authoring/tool-manifest" })).resolves.toMatchObject({
      contents: [expect.objectContaining({ text: expect.stringContaining('"requiredExecutables": []') })],
    });
    await expect(client.readResource({ uri: "scriptforge://authoring/ui-bridge" })).resolves.toMatchObject({
      contents: [expect.objectContaining({ text: expect.stringContaining("event.source === parent") })],
    });
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

    await client.callTool({
      name: "scriptforge_present_candidate",
      arguments: { summary: "The candidate is ready.", risks: ["Requires user-provided input"] },
    });
    expect(publishCandidate).toHaveBeenCalledWith(expect.objectContaining({ summary: "The candidate is ready." }));
    await Promise.all([client.close(), server.close()]);
  });
});
