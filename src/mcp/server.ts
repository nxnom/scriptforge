import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ForgeCandidateRequest, ForgePanelRequest } from "../server/forge/types.js";
import { forgeCandidateRequestSchema, forgePanelRequestSchema } from "../server/forge/types.js";
import { forgeMcpInstructions } from "./instructions.js";
import { authoringResource } from "./resources.js";

type ForgeMcpPublishers = {
  panel: (panel: ForgePanelRequest) => Promise<void>;
  candidate: (candidate: ForgeCandidateRequest) => Promise<void>;
};

export function createForgeMcpServer(publish: ForgeMcpPublishers) {
  const server = new McpServer({ name: "scriptforge", version: "0.1.0" }, { instructions: forgeMcpInstructions });
  server.registerResource(
    "scriptforge-authoring",
    new ResourceTemplate("scriptforge://authoring/{document}", { list: undefined }),
    {
      title: "ScriptForge tool authoring contract",
      description: "Exact tool-manifest, runner-event, and browser-host contracts.",
      mimeType: "text/plain",
    },
    (uri, variables) => ({
      contents: [{ uri: uri.href, mimeType: "text/plain", text: authoringResource(String(variables.document)) }],
    }),
  );
  server.registerTool(
    "scriptforge_show_panel",
    {
      title: "Show ScriptForge panel",
      description:
        "Pause Forge and replace the terminal with required user questions or an explicit plan approval. The panel must contain a question or approval. HTML suggestions run in a Shadow DOM without Tailwind; use ordinary CSS and never JavaScript.",
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
