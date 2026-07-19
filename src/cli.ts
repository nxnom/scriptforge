import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import open from "open";
import { WebSocketServer } from "ws";
import { createApp } from "./server/app.js";
import { CodexStatusService } from "./server/codex/status.js";
import { DoctorSessionService } from "./server/doctor/service.js";
import { ForgeSessionService } from "./server/forge/service.js";
import { selectPort } from "./server/port.js";
import { RequirementService } from "./server/requirements/service.js";
import { listToolCategories } from "./tools/categories.js";

const host = "127.0.0.1";
const port = await selectPort(4545);
const currentDir = dirname(fileURLToPath(import.meta.url));
const runningFromSource = fileURLToPath(import.meta.url).endsWith(".ts");
const webRoot = resolve(currentDir, "web");
const hasBuiltWeb = existsSync(resolve(webRoot, "index.html"));
const url = `http://${host}:${port}`;
const mcpEntry = resolve(currentDir, runningFromSource ? "mcp.ts" : "mcp.js");
const forgeSessions = new ForgeSessionService(
  new CodexStatusService(),
  undefined,
  undefined,
  undefined,
  {
    serverUrl: url,
    command: runningFromSource ? resolve(currentDir, "../node_modules/.bin/tsx") : process.execPath,
    args: [mcpEntry],
  },
  () => listToolCategories(),
);
const requirements = new RequirementService();
const doctorSessions = new DoctorSessionService(
  new CodexStatusService(),
  requirements,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  {
    serverUrl: url,
    command: runningFromSource ? resolve(currentDir, "../node_modules/.bin/tsx") : process.execPath,
    args: [mcpEntry],
  },
);
const app = createApp(hasBuiltWeb ? webRoot : undefined, { forgeSessions, requirements, doctorSessions });
const webSocketServer = new WebSocketServer({ noServer: true });

const server = serve({ fetch: app.fetch, hostname: host, port, websocket: { server: webSocketServer } }, async () => {
  console.log(`ScriptForge is running at ${url}`);
  console.log("Press Ctrl+C to stop.");

  if (!process.argv.includes("--no-open") && hasBuiltWeb) {
    await open(url);
  } else if (!hasBuiltWeb) {
    console.log("Web assets are not built. During development, open http://127.0.0.1:5173");
  }
});

function shutdown() {
  webSocketServer.close();
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
