import { execFile } from "node:child_process";

type CommandResult = {
  ok: boolean;
  notFound: boolean;
  stdout: string;
  stderr: string;
};

export type CodexReadiness = {
  installed: boolean;
  authenticated: boolean;
  version: string | null;
  authMethod: string | null;
};

export interface CodexStatusChecker {
  check(): Promise<CodexReadiness>;
}

type CodexCommandRunner = (args: string[]) => Promise<CommandResult>;

export class CodexStatusService implements CodexStatusChecker {
  constructor(private readonly run: CodexCommandRunner = runCodex) {}

  async check(): Promise<CodexReadiness> {
    const versionResult = await this.run(["--version"]);
    if (versionResult.notFound) {
      return { installed: false, authenticated: false, version: null, authMethod: null };
    }

    const loginResult = await this.run(["login", "status"]);
    const loginOutput = `${loginResult.stdout}\n${loginResult.stderr}`;
    return {
      installed: true,
      authenticated: loginResult.ok,
      version: versionResult.ok ? parseVersion(versionResult.stdout) : null,
      authMethod: loginResult.ok ? parseAuthMethod(loginOutput) : null,
    };
  }
}

function runCodex(args: string[]): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile("codex", args, { timeout: 5_000, windowsHide: true }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        notFound: isNotFound(error),
        stdout: String(stdout),
        stderr: String(stderr),
      });
    });
  });
}

function isNotFound(error: Error | null): boolean {
  return Boolean(error && "code" in error && error.code === "ENOENT");
}

function parseVersion(output: string): string | null {
  return output.match(/\d+\.\d+\.\d+(?:[-+][\w.-]+)?/)?.[0] ?? null;
}

function parseAuthMethod(output: string): string {
  if (/chatgpt/i.test(output)) return "ChatGPT";
  if (/api key/i.test(output)) return "API key";
  if (/access token/i.test(output)) return "access token";
  return "Codex credential";
}
