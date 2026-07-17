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

Status: Pending

- Scaffold the TypeScript workspace.
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

Status: Pending

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

Status: Pending

- Spawn the interactive Codex CLI through `node-pty`.
- Stream terminal input, output, and resizing over WebSocket.
- Register a local ScriptForge stdio MCP server with Codex.
- Generate candidate tool files only in staging.
- Keep the terminal full-width by default and open a contextual side panel for MCP questions, approvals, and the tester interface.
- Present read-only execution code, manifest, executable requirements, structured logs, and candidate status for review.
- Run the generated HTML/JS tester inside a sandboxed iframe with a controlled host bridge.
- Require approval before candidate tests or execution.
- Save only the reviewed candidate revision.

Acceptance checks:

- A user can describe a utility and collaborate with Codex in the embedded terminal.
- Codex produces a candidate manifest, script, and plain HTML interface.
- Nothing executes or enters the library without the relevant approval.
- A tested candidate can be saved and launched from the library.
- Codex is explicitly configured to use GPT-5.6.

## Goal 4 — Dependency Doctor

Status: Pending

- Check the executables declared in `tool.json`.
- Start a Doctor agent when an executable is missing.
- Let the agent determine OS-specific installation commands dynamically.
- Show commands and explanations before approval.
- Stream approved installation output and verify the executable afterward.

Acceptance checks:

- A missing executable is detected before tool execution.
- No installation command is stored in the tool manifest.
- No installation starts before explicit approval.
- Successful installation unblocks the tool.
- Unsupported systems receive actionable guidance.

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

## Post-Hackathon — Sharing

Status: Deferred

- Export a tool as one file.
- Import a shared tool without executing it.
- Use AI to explain imported code in plain language.
- Add integrity, compatibility, and provenance checks.
