import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ForgeCandidateRequest, ForgePanelRequest } from "../server/forge/types.js";
import { forgeCandidateRequestSchema, forgePanelRequestSchema } from "../server/forge/types.js";
import { forgeMcpInstructions } from "./instructions.js";

type ForgeMcpPublishers = {
  panel: (panel: ForgePanelRequest) => Promise<void>;
  candidate: (candidate: ForgeCandidateRequest) => Promise<void>;
};

export function createForgeMcpServer(publish: ForgeMcpPublishers) {
  const server = new McpServer({ name: "scriptforge", version: "0.1.0" }, { instructions: forgeMcpInstructions });
  server.registerTool(
    "scriptforge_show_panel",
    {
      title: "Show ScriptForge panel",
      description:
        "Use only when essential user clarification is required. Replaces the terminal with ordered markdown, Mermaid diagram, CSS-styled HTML mockup, and interactive question blocks plus an Approve & start action. Ask every genuinely necessary question, but never use this for unsolicited plans, status, implementation details, or summaries. Mermaid belongs in a diagram block, not Markdown. HTML runs in a Shadow DOM with ordinary CSS and no JavaScript.",
      inputSchema: forgePanelRequestSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (panel) => {
      await publish.panel(panel);
      return {
        content: [
          {
            type: "text",
            text: "The terminal is hidden and the blocking panel is visible. Wait for the user to submit it.",
          },
        ],
      };
    },
  );
  server.registerTool(
    "scriptforge_present_candidate",
    {
      title: "Present ScriptForge candidate",
      description:
        "Present the actual tool.json, run.mjs, and ui.html from staging after they are coherent. ScriptForge validates and reads the files; provide only a summary and unresolved risks.",
      inputSchema: forgeCandidateRequestSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (candidate) => {
      await publish.candidate(candidate);
      return {
        content: [{ type: "text", text: "The candidate review is visible. Wait for approval or requested changes." }],
      };
    },
  );
  return server;
}
