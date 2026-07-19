import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDoctorMcpServer } from "./mcp/doctor-server.js";
import { createForgeMcpServer } from "./mcp/server.js";

const serverUrl = requiredArg("--server-url");
const sessionId = requiredArg("--session-id");
const token = requiredArg("--token");
const mode = optionalArg("--mode") ?? "forge";
const allowDependencyInstalls = optionalArg("--allow-dependency-installs") === "true";

const server =
  mode === "doctor"
    ? createDoctorMcpServer((proposal) => publishDoctor(proposal))
    : createForgeMcpServer(
        {
          panel: (panel) => publish("panel", panel),
          candidate: (candidate) => publish("candidate", candidate),
        },
        { allowDependencyInstalls },
      );

await server.connect(new StdioServerTransport());

async function publish(path: "panel" | "candidate", body: unknown) {
  const response = await fetch(`${serverUrl}/api/forge/sessions/${encodeURIComponent(sessionId)}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`ScriptForge rejected ${path}: ${await response.text()}`);
}

async function publishDoctor(body: unknown) {
  const response = await fetch(`${serverUrl}/api/doctor/sessions/${encodeURIComponent(sessionId)}/proposal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`ScriptForge rejected the install proposal: ${await response.text()}`);
}

function requiredArg(name: string) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function optionalArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
