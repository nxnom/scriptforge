import { appendFile, mkdir, readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const defaultConfigPath = join(homedir(), ".codex", "config.toml");
let trustQueue = Promise.resolve();

export function ensureCodexTrusted(directory: string, configPath = defaultConfigPath) {
  const update = trustQueue.then(() => appendTrust(directory, configPath));
  trustQueue = update.catch(() => undefined);
  return update;
}

async function appendTrust(directory: string, configPath: string) {
  const resolvedDirectory = await realpath(directory).catch(() => directory);
  const escapedDirectory = resolvedDirectory.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const header = `[projects."${escapedDirectory}"]`;
  const contents = await readFile(configPath, "utf8").catch(() => "");
  if (contents.includes(header)) return;

  await mkdir(dirname(configPath), { recursive: true });
  const separator = contents === "" || contents.endsWith("\n") ? "" : "\n";
  await appendFile(configPath, `${separator}\n${header}\ntrust_level = "trusted"\n`, "utf8");
}
