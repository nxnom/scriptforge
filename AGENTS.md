# OpenAI Build Week Project Instructions

This repository is being built for the OpenAI Build Week Challenge. These instructions apply to every agent and contributor working in this repository.

## Mission

Build a polished, working project named **ScriptForge** with Codex using GPT-5.6.

**Track:** Apps for your life

**Pitch:** ScriptForge is a local app store where small utility apps do not exist until the user asks Codex to forge them.

The challenge offers these tracks:

- Apps for your life
- Work and productivity
- Developer tools
- Education

The selected track and pitch above are settled. Record them in the README once the application scaffold exists.

## Product Contract

- Running `npx scriptforge` starts a local server and opens the ScriptForge library in the user's browser.
- The library contains small file utilities with focused interfaces, progress feedback, and useful result previews.
- The first starter tool is an image resizer powered by the bundled `sharp` dependency. It must require no separate system executable.
- The Forge experience launches the interactive Codex CLI through `node-pty`. Browser terminal input/output and resizing travel over WebSocket.
- Codex connects to a ScriptForge MCP server, creates a candidate tool in a staging area, collaborates with the user, and reports when it is ready for review.
- A generated tool has a manifest, an execution script, and a self-contained interface written in plain HTML, CSS, and JavaScript. Generated interfaces do not use React or GeckoUI.
- `tool.json` declares required executable names and optional version constraints. It never contains installation commands.
- The Doctor agent detects missing executables, determines installation steps for the current operating system, explains the exact commands, and waits for explicit approval before execution.
- No generated tool is installed into the library until the user reviews it and clicks Save.
- Installed tools can be exported as one `.forge` archive and imported back into the local library. Import validates and extracts files without executing them; missing executable requirements do not reject the import and block only later runs.

## Technical Direction

- Node.js and TypeScript
- Hono local server
- React application shell
- React Router for application navigation
- Tailwind CSS utilities for React-side layout and styling; do not add project-specific CSS class selectors for React components
- GeckoUI for the main ScriptForge interface only
- React Hook Form with Zod validation and GeckoUI RHF components for application forms
- Spoosh for typed REST calls, deriving the client schema from Hono with `@spoosh/hono`
- WebSocket for terminal streams and real-time job events
- `node-pty` for interactive Codex and approved terminal sessions
- Codex CLI configured for GPT-5.6 and connected to ScriptForge through a local stdio MCP server
- `sharp` for the starter image resizer
- Biome for formatting and linting
- macOS-first behavior without intentionally breaking Windows or Linux

Keep REST operations and real-time streams distinct: use Spoosh for request/response APIs and WebSocket for terminal bytes, progress, logs, and job lifecycle events.

## Runtime and UI Decisions

- Bind only to `127.0.0.1`. Prefer port `4545`; if occupied, select another available port and show the chosen URL.
- Treat `ui.pen` as the visual source of truth for the main application. Read it only through Pencil MCP tools. Use its components, text, icons, tokens, typography, and spacing when implementing React screens.
- The Forge screen embeds the real interactive Codex TUI with xterm.js.
- The Forge side panel is hidden by default. Reveal it contextually when Codex asks for human input or approval, or when a candidate tester UI is ready.
- Render the generated tester interface in the side panel. Do not show its HTML source in the normal review flow.
- Show the generated execution script in a read-only code viewer. Changes are requested through the Codex conversation.
- Run generated HTML/JS inside a sandboxed iframe. Its only application access is a controlled host bridge for input selection, execution, lifecycle, progress, structured logs, cancellation, and safe result URLs.
- Use a JavaScript `run.mjs` orchestration entrypoint for the MVP. It may invoke any executable declared in `tool.json` through the controlled runtime context.
- Every generated script must produce useful structured logs for startup, major stages, external commands, completion, and failures. Capture raw CLI output as collapsible detail rather than the primary presentation.
- Always provide automatic `queued`, `running`, `succeeded`, `failed`, and `cancelled` lifecycle events. Detailed percentage progress is optional when the underlying work can measure it.
- Store installed tools under `~/.scriptforge/tools`, candidates under `~/.scriptforge/staging`, and temporary job data under `~/.scriptforge/jobs`.
- Do not add SQLite. Discover tools from filesystem manifests and use `~/.scriptforge/settings.json` only for small application preferences.
- Preserve Forge candidates across restarts. Delete temporary job inputs and outputs older than 24 hours during startup.
- Use one publishable `scriptforge` package containing the CLI, Hono server, React/Vite application, and built web assets. Use pnpm for development while keeping `npx scriptforge` npm-compatible.
- Before starting Forge, show a GeckoUI dialog with model and reasoning-effort selects. Store those two UI preferences in browser `localStorage`, not `settings.json`.
- Default to `gpt-5.6-sol` with `medium` reasoning effort. Offer `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, and `gpt-5.2` as additional model choices, subject to the installed Codex CLI and account.
- Offer `minimal`, `low`, `medium`, `high`, and `xhigh` effort choices.
- Check that Codex CLI exists and is authenticated before Forge starts. If not, keep the library usable and show installation/login guidance plus Retry. Never install or authenticate Codex automatically.

## Safety Contract

1. Codex may create and modify candidate files only inside a dedicated staging directory before Save.
2. Do not launch Codex with `--dangerously-bypass-approvals-and-sandbox`.
3. Generating files in staging does not authorize executing them.
4. Approving the Forge kickoff explicitly authorizes Codex to run bounded standalone checks of the candidate inside staging. Installing executables and saving a tool remain separate explicit user-controlled actions.
5. Installation commands are generated for the current machine at run time; they are never embedded in a shared or local tool manifest.
6. A tool may invoke only the executables it declares. Surface undeclared executable attempts as errors.
7. Generated browser code must not receive direct Node.js, shell, or unrestricted filesystem access.
8. Review and save the exact candidate revision that was tested; detect changes made after review.
9. Any script change invalidates the previous successful test status.
10. Redact secrets, environment values, and unsafe filesystem details from logs before sending them to browser code.

## Delivery Workflow

- Work through `docs/GOALS.md` one milestone at a time.
- Keep the application working at every milestone boundary.
- Do not begin the next milestone until the current milestone's acceptance checks pass.
- Commit each completed, verified unit of work separately with a focused conventional commit message.
- Add `Co-authored-by: Codex <codex@openai.com>` to commits created during this Codex build session.
- Update product documentation and the Build Week evidence log when a decision or completed feature changes them.

## Deadline

The submission deadline supplied by the project owner is **Tuesday, July 21, 2026 at 5:00 PM Pacific Time** (Wednesday, July 22, 2026 at 7:00 AM in Asia/Bangkok, assuming Pacific Daylight Time).

Treat the official Devpost challenge page, Official Rules, and submission form as the final authority. Flag any conflict between those sources and this file immediately.

## Required Deliverables

The project is not submission-ready until all of the following exist:

- A working, testable project built with Codex and GPT-5.6.
- One selected challenge category.
- A clear project description explaining the problem, solution, intended users, and how it works.
- A public YouTube demo video shorter than three minutes.
- Demo audio that explicitly explains how both Codex and GPT-5.6 were used.
- A repository URL that judges can access and test.
- A README with prerequisites, setup instructions, environment variables, run/test commands, sample data if needed, and troubleshooting notes.
- Clear evidence of where Codex accelerated development, where important technical or product decisions were made, and how GPT-5.6 powers or helped build the project.
- The `/feedback` Codex Session ID from the session in which the majority of the core functionality was built.

If the repository is public, include an appropriate license and ensure no secrets or private data are committed. If it is private, remind the project owner before submission to grant access to:

- `testing@devpost.com`
- `build-week-event@openai.com`

## Build Rules

1. Prefer a narrow, demonstrable core experience over a broad unfinished feature set.
2. Keep the main user journey runnable locally with the fewest practical setup steps.
3. Use GPT-5.6 for a meaningful, visible capability or clearly document its material role in building the project. Do not make unsupported claims about model use.
4. Use Codex for implementation and preserve the primary build session so its `/feedback` Session ID can be submitted.
5. Use the repository's installed skills whenever the task matches their documented purpose. Read each applicable `SKILL.md` before acting and follow its workflow.
6. Make informed, reversible assumptions when details are missing. Ask the project owner before decisions that materially change the product idea, track, external services, cost, privacy posture, or submission scope.
7. Never commit API keys, access tokens, credentials, personal data, or generated secret files. Provide a sanitized `.env.example` where configuration is required.
8. Use only assets, datasets, libraries, and media that can legally be included or demonstrated. Record attribution and licenses when required.
9. Keep changes focused. Preserve unrelated user work and do not use destructive version-control commands.
10. Verify important behavior with automated tests where practical and manually test the complete demo path before calling the project complete.
11. Keep sharing limited to the owner-approved `.forge` archive import/export flow. Do not add marketplaces, remote publishing, provenance services, or AI import explanations unless the project owner explicitly requests them.
12. Keep React component and form modules focused and roughly 200 lines or fewer. Treat 250 lines as the maximum; split larger files by page, component, schema, or responsibility before adding more behavior.
13. Build forms with React Hook Form, Zod schemas, `zodResolver`, and GeckoUI RHF components. Do not duplicate form state in ad-hoc `useState` hooks. Move substantial schemas and reusable field groups into their own focused files.
14. Tool packages contain `tool.json`, their execution files, and `ui.html`; do not generate separate test files inside a tool. After kickoff approval, Codex must exercise the standalone runner with realistic temporary input, fix failures, rerun it, and report the successful check before presenting the candidate. The exact candidate revision is then tested through an explicit user-approved run in the sandboxed tester iframe before Save. Keep automated tests focused on ScriptForge's host bridge, runner, validation, and safety boundaries.
15. Style the React ScriptForge shell with Tailwind utility classes directly in components. Keep global CSS limited to imports, design tokens, base element rules, and targeted GeckoUI theme overrides. Self-contained tool `ui.html` files may use ordinary CSS classes and do not depend on Tailwind.

## Evidence Log

Maintain a section named **Build Week Evidence** in the README throughout development. Update it as work happens, not only at the end. It must include:

- Selected track and why the project fits it.
- The exact GPT-5.6 model identifier and where it is configured.
- The user-facing features powered by GPT-5.6.
- Specific examples of work accelerated by Codex.
- Important product and technical decisions, including tradeoffs.
- Tests or evaluations used to verify quality.
- Primary Codex Session ID: `019f7198-5cb2-74b2-96a8-c8909989d1b2`.

Do not fabricate metrics, model identifiers, session IDs, user feedback, or evaluation results.

## README Minimum Structure

Keep the README usable by a judge encountering the project for the first time:

1. Project name and one-sentence pitch
2. Challenge track
3. Problem and solution
4. Demo link
5. Key features
6. Architecture and how GPT-5.6 is used
7. Prerequisites and setup
8. Environment variables
9. Run, test, and sample-data instructions
10. Build Week Evidence
11. Limitations and future work
12. License and acknowledgements

## Demo Requirements

Design the project and demo around a reliable end-to-end path that fits comfortably within three minutes. The video should:

- State the problem and selected track quickly.
- Show the working product, not only slides or mockups.
- Demonstrate the core GPT-5.6-powered interaction with realistic input.
- Explain the role of GPT-5.6 and how Codex accelerated the build.
- End with the outcome or value delivered.
- Avoid exposing secrets, private data, local filesystem details, or unrelated browser tabs.

Before recording, prepare deterministic sample data or a graceful fallback for network-dependent behavior when practical.

## Definition of Done

Do not declare the project complete until:

- A fresh user can follow the README and run the project.
- The primary workflow succeeds from start to finish.
- Relevant tests, linting, type checks, and builds pass.
- Error, loading, and empty states are reasonable for the demo path.
- Secrets and sensitive data have been checked out of the repository and video.
- The public demo URL and accessible repository URL are ready.
- The project description and category are finalized.
- The video is public on YouTube and shorter than three minutes.
- The `/feedback` Session ID is recorded in the README and submission form.
- The official rules and Devpost submission checklist have been reviewed one final time.

## Submission Checklist

Before the deadline, remind the project owner to verify and submit:

- [ ] Official Rules and eligibility reviewed
- [ ] Correct track selected
- [ ] Working project tested
- [ ] Project description finalized
- [ ] Public YouTube demo under three minutes
- [ ] Demo audio covers both Codex and GPT-5.6
- [ ] Repository URL accessible to judges
- [ ] Private-repository judge access granted, if applicable
- [ ] README setup and sample data verified from a clean environment
- [ ] License and required attributions included
- [ ] GPT-5.6 usage and Codex contributions clearly highlighted
- [ ] Primary `/feedback` Codex Session ID captured and entered
- [ ] Submission completed before the official deadline
