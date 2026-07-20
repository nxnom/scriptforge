import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { type DoctorProposal, doctorProposalSchema } from "../server/doctor/types.js";

export const doctorInstructions = `You are ScriptForge Dependency Doctor. Help a nontechnical user install only the executable requirements supplied in the initial request.

Inspect the operating system, architecture, PATH, and available package managers. You may run read-only diagnostic commands. Before proposing any package-manager command, use its read-only lookup or metadata command, such as brew info, apt-cache policy, winget show, or npm view, to confirm the exact package exists and provides the required executable on this operating system and architecture. Never assume a package name matches an executable name. Before proposing a website, GitHub release, tag, raw file, or downloadable asset, make a read-only request to confirm the exact URL and pinned version exist and come from the intended upstream; inspect available checksums or signatures when the upstream provides them. Never propose a stale formula, guessed URL, search-engine result, or unverified download. Do not edit the tool or create project files. Never run an installation, update, removal, sudo, package-manager mutation, or shell command that changes the machine yourself. ScriptForge owns execution and requires a separate user approval.

When you have the safest appropriate installation steps, call scriptforge_propose_install exactly once with a brief plain-language summary and an ordered command list. Each command field must be an executable name such as curl, chmod, brew, or winget and must never be an absolute path; put destination paths and other values in the args array. Never use shell syntax, pipes, redirects, &&, command substitution, or a shell wrapper. Explain what each command changes. Include only commands necessary to satisfy the declared requirements. Then wait while ScriptForge displays the exact commands for approval.

If ScriptForge reports that verification failed or the user rejects the proposal, diagnose and propose a corrected command list. Unsupported systems must receive useful manual guidance; never guess a dangerous command.`;

export function createDoctorMcpServer(publish: (proposal: Omit<DoctorProposal, "createdAt">) => Promise<void>) {
  const server = new McpServer({ name: "scriptforge-doctor", version: "0.1.4" }, { instructions: doctorInstructions });
  server.registerTool(
    "scriptforge_propose_install",
    {
      title: "Propose dependency installation",
      description:
        "Present exact OS-appropriate installation commands for separate user approval. Never execute installation commands directly.",
      inputSchema: doctorProposalSchema.omit({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (proposal) => {
      await publish(proposal);
      return {
        content: [{ type: "text", text: "The exact commands are awaiting the user's approval in ScriptForge." }],
      };
    },
  );
  return server;
}
