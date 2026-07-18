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
        "Required before creating a new candidate. Replace the terminal with a short, nontechnical description of what the user will get, any genuinely necessary questions, and an approval block labeled Approve & start / Request changes. Markdown, Mermaid diagrams, and CSS-styled HTML mockups may support the decision. Never include technical implementation details or use this for build progress. Mermaid belongs in a diagram block; HTML uses ordinary CSS in a Shadow DOM and no JavaScript.",
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
        "Present the actual tool.json, run.mjs, and ui.html from staging after they are coherent. The preview opens beside the interactive terminal so revisions continue there. ScriptForge validates and reads the files; provide only a short user-facing summary and meaningful risks.",
      inputSchema: forgeCandidateRequestSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (candidate) => {
      await publish.candidate(candidate);
      return {
        content: [
          {
            type: "text",
            text: "The candidate preview is visible beside the terminal. Continue the conversation there and present again after revisions.",
          },
        ],
      };
    },
  );
  return server;
}
