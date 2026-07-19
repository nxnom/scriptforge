# ScriptForge Goals

Build one milestone at a time. Each milestone ends with its acceptance checks passing and a focused commit before work begins on the next milestone.

## Goal 0 — Product Baseline

Status: Complete

- Record the product, architecture, scope, and safety contract.
- Establish repository workflow and commit attribution.
- Capture unresolved decisions without blocking unrelated work.

Acceptance checks:

- `AGENTS.md` reflects the agreed ScriptForge requirements.
- Product and milestone documents exist.
- Git is initialized and the baseline is committed.

## Goal 1 — Always-Working Local App

Status: Complete

- Scaffold the TypeScript workspace.
- Keep the CLI, server, and web application in one publishable npm package.
- Start a Hono server from the CLI.
- Serve the React application and open it in the default browser.
- Bind to localhost and handle port selection and shutdown cleanly.
- Prefer port `4545` and fall back when it is unavailable.
- Add GeckoUI and a basic ScriptForge visual theme.
- Implement the Library screen from `ui.pen` through the Pencil MCP design source.
- Wire Hono types into Spoosh REST calls.

Acceptance checks:

- A clean install succeeds.
- The development checks pass.
- Running the CLI opens a working library shell.
- A health request flows from React through Spoosh to Hono with inferred types.

## Goal 2 — Image Resizer End to End

Status: Complete

- Define the minimal internal tool manifest and registry.
- Ship one bundled image-resizer tool using `sharp`.
- Support drag-and-drop or file selection, resize controls, progress, and before/after output.
- Handle invalid input and failed processing clearly.

Acceptance checks:

- The image resizer appears in the library.
- A sample image can be resized from the browser.
- The original and result can be compared.
- The result can be saved locally.
- No external executable is required.

## Goal 3 — Forge with Codex

Status: Complete

Completed and verified:

- Codex installation and authentication preflight with manual setup guidance.
- Browser-persisted model and reasoning-effort selection.
- `node-pty` launch in a dedicated staging directory with the selected GPT-5.6 model while preserving the user's Codex permission configuration.
- Real interactive xterm.js terminal input, output, and resizing over WebSocket.
- One server-owned in-memory Forge session that reconnects and replays output after browser refresh.
- Session-scoped ScriptForge stdio MCP server with Forge-specific Codex instructions.
- Mandatory plain-language kickoff approval with validated questions and separate Markdown, Mermaid, HTML, and input blocks that replace the terminal while Codex waits.
- Kickoff-authorized standalone runner checks with required test evidence before candidate presentation.
- Staging-file candidate discovery with a sandboxed `ui.html` preview and read-only script/details review beside the live terminal.
- Exact-revision candidate execution through the sandboxed tester bridge, including tools with no file input or downloadable output.
- Explicit Stop control for the one active in-memory Codex terminal and Start session only when none is active.
- Exact-revision test tracking and atomic saving into the filesystem-backed tool library.

Acceptance checks:

- A user can describe a utility and collaborate with Codex in the embedded terminal.
- Codex produces a candidate manifest, script, and plain HTML interface.
- Nothing executes or enters the library without the relevant approval.
- A tested candidate can be saved and launched from the library.
- Codex is explicitly configured to use GPT-5.6.

## Goal 4 — Dependency Doctor

Status: Complete

Completed and verified:

- Detect declared executables and basic version constraints from the current `PATH`.
- Keep tools installed and reviewable when requirements are missing while marking them Needs install.
- Block only job execution until every declared executable requirement is satisfied.
- Show manual install/retry guidance without launching Codex automatically.
- Start a separate Codex Doctor only after the user explicitly requests help.
- Let Doctor inspect the current OS and package managers without modifying the machine itself.
- Present structured command-and-argument proposals with plain-language explanations.
- Run only the exact proposal after the user clicks Install, with live terminal output.
- Recheck requirements after installation and preserve the active in-memory Doctor session across refreshes.

Acceptance checks:

- A missing executable is detected before tool execution.
- No installation command is stored in the tool manifest.
- No installation starts before explicit approval.
- Successful installation unblocks the tool.
- Unsupported systems receive actionable guidance.

## Goal 4.5 — Portable Tool Archives

Status: Complete

- Export every installed tool file into one dependency-free `.forge` archive.
- Import the archive through a validated, traversal-safe, atomic extraction path.
- Never execute code during import.
- Keep valid imported tools when executables are missing and hand them to the existing Doctor flow.
- Let users delete Forge-saved and imported tools after confirmation while protecting bundled tools.

Acceptance checks:

- Nested supporting files survive an export/import round trip.
- Invalid paths, duplicate paths, malformed manifests, oversized archives, and bundled-ID collisions are rejected.
- An imported tool with a missing executable appears as Needs install.
- Only execution is blocked until Doctor or the user supplies the dependency.
- Deletion removes an installed tool atomically, and bundled deletion is rejected by both the UI and server.

## Goal 5 — Hackathon Submission

Status: Pending

- Polish the primary demo path.
- Add only the starter tools needed to strengthen the demo.
- Complete README setup, architecture, evidence, limitations, and license sections.
- Record a public demo shorter than three minutes.
- Capture the primary `/feedback` Codex Session ID.
- Verify repository access and complete the Devpost submission.

Acceptance checks:

- A fresh user can run the documented demo path.
- Tests, linting, type checks, and builds pass.
- The video shows the product and explains both GPT-5.6 and Codex usage.
- Every item in the `AGENTS.md` submission checklist is complete.

## Post-Hackathon — Extended Sharing

Status: Deferred

- Add archive signing, provenance, and compatibility metadata.
- Add remote publishing or a shared catalog only if the product direction calls for it.
