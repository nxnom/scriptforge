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
- Use the `UVKcL` rail-and-grid composition with responsive status/category selects, a blue safe-import panel, dynamic manifest-derived categories, and the `#5468ff` primary theme.
- Wire Hono types into Spoosh REST calls.

Acceptance checks:

- A clean install succeeds.
- The development checks pass.
- Running the CLI opens a working library shell.
- A health request flows from React through Spoosh to Hono with inferred types.

## Goal 2 — Image Resizer End to End

Status: Complete

- Define the minimal internal tool manifest and registry.
- Support one to three categories per tool, normalize the legacy singular category, and supply existing category names to Forge for reuse.
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
- `node-pty` launch in a dedicated staging directory with the selected GPT-5.6 model, preserving the user's Codex permission configuration by default and offering an explicit, warned preflight opt-in to bypass approval and sandbox prompts.
- Real interactive xterm.js terminal input, output, and resizing over WebSocket.
- One server-owned in-memory Forge session that reconnects and replays output after browser refresh.
- Session-scoped ScriptForge stdio MCP server with Forge-specific Codex instructions.
- Mandatory plain-language kickoff approval with validated questions and separate Markdown, Mermaid, HTML, and input blocks that replace the terminal while Codex waits.
- Kickoff-authorized standalone runner checks with required test evidence before candidate presentation.
- Staging-file candidate discovery with a sandboxed `ui.html` preview and read-only script/details review beside the live terminal.
- Exact-revision candidate execution through the sandboxed tester bridge, including tools with no file input or downloadable output.
- Explicit Stop control for the one active in-memory Codex terminal and Start session only when none is active.
- Exact-revision test tracking and atomic saving into the filesystem-backed tool library.
- Successful Save stops the Forge Codex session and redirects to the installed tool detail page.

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
- Show installed tools through Preview, read-only Script, and read-only Details tabs without exposing `ui.html` source.
- Block only job execution until every declared executable requirement is satisfied.
- Show manual install/retry guidance without launching Codex automatically.
- Start a separate Codex Doctor agent only after the user explicitly requests help, embedded beside the tool interface.
- Let Doctor inspect the current OS and package managers without modifying the machine itself.
- Present structured command-and-argument proposals with plain-language explanations.
- Run only the exact proposal after the user clicks Install, with live terminal output.
- Stop and detach Codex after approval so the installation terminal contains only installer output.
- Recheck requirements after installation and preserve the active in-memory Doctor session across refreshes.
- Close successful Doctor sessions automatically so the tool is immediately ready to test.

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
- Make available cards direct navigation targets, with compact card menus and tooltip-labeled detail actions.

Acceptance checks:

- Nested supporting files survive an export/import round trip.
- Invalid paths, duplicate paths, malformed manifests, oversized archives, and bundled-ID collisions are rejected.
- An imported tool with a missing executable appears as Needs install.
- Only execution is blocked until Doctor or the user supplies the dependency.
- Deletion removes an installed tool atomically, and bundled deletion is rejected by both the UI and server.

## Goal 4.6 — Encrypted Tool Configuration

Status: Complete

- Let tools declare persistent text, secret, textarea, number, boolean, and select configuration fields.
- Render configuration in trusted GeckoUI forms instead of generated tool HTML.
- Encrypt secret values locally with authenticated encryption and keep every value outside exported tool directories.
- Prompt for missing required configuration when a run is requested, then continue the original run after Save.
- Inject resolved configuration only into the runner request and redact known secrets from browser-visible events.
- Support the same configuration flow for installed tools and Forge candidate previews.

Acceptance checks:

- Required missing values block execution and open the configuration form.
- Saved secrets are encrypted at rest and are never returned by configuration APIs.
- An empty secret submission preserves the saved value; explicit removal is separate.
- Runner logs, errors, result data, and metadata redact known secret values.
- `.forge` exports contain no configuration values or encryption material.
- Deleting a user tool also removes its configuration file.

## Goal 5 — Hackathon Submission

Status: Pending

- Polish the primary library into a compact, sidebar-free workspace with a fixed header/filter area, scrollable tool results, and a pinned import action.
- Polish tool detail pages from Pencil node `y4sqS` with a compact metadata sidebar, underline review tabs, a focused preview workspace, and the current `#5468ff` tool-interface theme.
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
