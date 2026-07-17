import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import open from "open";
import { createApp } from "./server/app.js";
import { selectPort } from "./server/port.js";

const host = "127.0.0.1";
const port = await selectPort(4545);
const currentDir = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(currentDir, "web");
const hasBuiltWeb = existsSync(resolve(webRoot, "index.html"));
const app = createApp(hasBuiltWeb ? webRoot : undefined);
const url = `http://${host}:${port}`;

const server = serve({ fetch: app.fetch, hostname: host, port }, async () => {
  console.log(`ScriptForge is running at ${url}`);
  console.log("Press Ctrl+C to stop.");

  if (!process.argv.includes("--no-open") && hasBuiltWeb) {
    await open(url);
  } else if (!hasBuiltWeb) {
    console.log("Web assets are not built. During development, open http://127.0.0.1:5173");
  }
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
