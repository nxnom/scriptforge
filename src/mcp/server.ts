import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ForgeCandidateRequest, ForgePanelRequest } from "../server/forge/types.js";
import { forgeCandidateRequestSchema, forgePanelRequestSchema } from "../server/forge/types.js";
import { createForgeMcpInstructions } from "./instructions.js";

type ForgeMcpPublishers = {
  panel: (panel: ForgePanelRequest) => Promise<void>;
  candidate: (candidate: ForgeCandidateRequest) => Promise<void>;
};

export function createForgeMcpServer(publish: ForgeMcpPublishers, options: { allowDependencyInstalls?: boolean } = {}) {
  const server = new McpServer(
    { name: "scriptforge", version: "0.1.0" },
    { instructions: createForgeMcpInstructions(options) },
  );
  server.registerTool(
    "scriptforge_show_panel",
    {
      title: "Show ScriptForge panel",
      description:
        "Required before creating a new candidate. Replace the terminal with a short, nontechnical description of what the user will get, any genuinely necessary questions, and an approval block labeled Approve, build & check / Request changes. Explain that approval allows a local standalone check before review. Never include technical implementation details or use this for build progress.",
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
        "Present the actual tool.json, run.mjs, and ui.html from staging only after run.mjs passes a realistic standalone check. The preview opens beside the interactive terminal so revisions continue there. Provide a short user-facing summary, what was actually tested in testSummary, and meaningful risks.",
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
