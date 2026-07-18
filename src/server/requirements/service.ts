import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, join } from "node:path";
import type { ToolManifest } from "../../tools/manifest";

export type ExecutableRequirement = ToolManifest["requiredExecutables"][number];
export type ExecutableRequirementStatus = ExecutableRequirement & {
  available: boolean;
  detectedVersion: string | null;
  reason: "available" | "missing" | "version_mismatch" | "version_unknown";
};

type Probe = (name: string) => Promise<{ found: boolean; version: string | null }>;

export class RequirementService {
  constructor(private readonly probe: Probe = probeExecutable) {}

  async check(requirements: ExecutableRequirement[]) {
    return Promise.all(
      requirements.map(async (requirement): Promise<ExecutableRequirementStatus> => {
        const result = await this.probe(requirement.name);
        if (!result.found) return { ...requirement, available: false, detectedVersion: null, reason: "missing" };
        if (!requirement.version)
          return { ...requirement, available: true, detectedVersion: result.version, reason: "available" };
        if (!result.version)
          return { ...requirement, available: false, detectedVersion: null, reason: "version_unknown" };
        const available = satisfiesVersion(result.version, requirement.version);
        return {
          ...requirement,
          available,
          detectedVersion: result.version,
          reason: available ? "available" : "version_mismatch",
        };
      }),
    );
  }

  async assertAvailable(requirements: ExecutableRequirement[]) {
    const statuses = await this.check(requirements);
    const blocked = statuses.filter((status) => !status.available);
    if (blocked.length)
      throw new Error(
        `Install the required ${blocked.map((item) => item.name).join(", ")} executable before running this tool.`,
      );
  }
}

async function probeExecutable(name: string) {
  const path = await resolveExecutable(name);
  if (!path) return { found: false, version: null };
  const output = await executableVersion(path);
  return { found: true, version: parseVersion(output) };
}

async function resolveExecutable(name: string) {
  const directories = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32" ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT").split(";") : [""];
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = join(directory, process.platform === "win32" ? `${name}${extension}` : name);
      try {
        await access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
        return candidate;
      } catch {
        // Continue searching PATH.
      }
    }
  }
}

function executableVersion(path: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(path, ["--version"], { timeout: 5_000, windowsHide: true }, (_error, stdout, stderr) => {
      resolve(`${stdout}\n${stderr}`);
    });
  });
}

function parseVersion(output: string) {
  return output.match(/\d+(?:\.\d+){0,3}/)?.[0] ?? null;
}

function satisfiesVersion(actual: string, constraint: string) {
  const match = constraint.trim().match(/^(>=|<=|>|<|=|~|\^)?\s*(\d+(?:\.\d+){0,3})$/);
  if (!match) return false;
  const operator = match[1] ?? ">=";
  const expected = match[2] ?? "0";
  const comparison = compareVersions(actual, expected);
  if (operator === ">") return comparison > 0;
  if (operator === ">=") return comparison >= 0;
  if (operator === "<") return comparison < 0;
  if (operator === "<=") return comparison <= 0;
  if (operator === "=") return comparison === 0;
  const [major = 0, minor = 0] = expected.split(".").map(Number);
  const upper = operator === "^" ? `${major + 1}.0.0` : `${major}.${minor + 1}.0`;
  return comparison >= 0 && compareVersions(actual, upper) < 0;
}

function compareVersions(left: string, right: string) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
