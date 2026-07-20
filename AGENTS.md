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
- `tool.json` declares executable dependencies and optional version constraints so Doctor can diagnose missing software. It never contains installation commands. This declaration is informative for readiness and portability; tool runners are trusted local programs and are not sandboxed to the declared list.
- `tool.json` declares one to three categories. Forge should normally choose one or two, reuse an existing library category when it fits, and create a new short category only when no existing category is accurate. Legacy installed manifests with one `category` remain supported.
- `tool.json` may declare persistent configuration fields but never configuration values. ScriptForge renders those fields in the trusted React shell, encrypts secret values locally, and injects resolved configuration only into the runner request.
- The Doctor agent detects missing executables, determines installation steps for the current operating system, explains the exact commands, and waits for explicit approval before execution.
- No generated tool is installed into the library until the user reviews it and clicks Save.
- A successful first Save keeps the owning Forge Codex session alive and changes the action to Update; only the explicit Stop action ends the session. Installed user-tool detail pages can open their own terminal-and-tool update workspace, while bundled tools cannot be updated.
- Forge sessions are scoped rather than globally exclusive: one new-tool session may run alongside one update session per installed tool. Starting or stopping one scope never replaces or ends the others.
- User tools saved from Forge or added through Import can be exported as one `.forge` archive or deleted after confirmation. Bundled starter tools cannot be deleted. Import validates and extracts files without executing them; missing executable requirements do not reject the import and block only later runs.

## Technical Direction

- Node.js and TypeScript
- Hono local server
- React application shell
- React Router for application navigation
- Tailwind CSS utilities for React-side layout and styling; do not add project-specific CSS class selectors for React components
- GeckoUI for the main ScriptForge interface only
- ScriptForge's primary brand color is `#5468ff`; keep GeckoUI primary tokens and generated-tool visual guidance aligned with it.
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
- Generated interfaces must fluidly use the full iframe width and adapt between the narrow Forge tester and wide installed Tool page. Do not default the entire app to a centered max-width wrapper; use responsive, tool-appropriate input and result regions.
- Show the generated execution script in a read-only code viewer. Changes are requested through the Codex conversation.
- Run generated HTML/JS inside a same-origin iframe without a sandbox attribute or restrictive Content Security Policy. Tool interfaces may use browser APIs, ScriptForge APIs, remote network services, CDNs, modules, workers, frames, forms, media devices, and browser filesystem pickers. Review third-party licenses and pin important remote dependencies when practical.
- Use a JavaScript `run.mjs` orchestration entrypoint for the MVP. It is a trusted local Node.js program with the same filesystem and network permissions as the ScriptForge process and may invoke local executables. Declare external executable dependencies so readiness checks and Doctor remain useful.
- Every generated script must produce useful structured logs for startup, major stages, external commands, completion, and failures. Capture raw CLI output as collapsible detail rather than the primary presentation.
- Always provide automatic `queued`, `running`, `succeeded`, `failed`, and `cancelled` lifecycle events. Detailed percentage progress is optional when the underlying work can measure it.
- Store installed tools under `~/.scriptforge/tools`, candidates under `~/.scriptforge/staging`, and temporary job data under `~/.scriptforge/jobs`.
- Store per-tool values under `~/.scriptforge/config` and a generated encryption key under `~/.scriptforge/secure`. Neither location is part of tool export. Secret values must never be returned to browser code after saving.
- Do not add SQLite. Discover tools from filesystem manifests and use `~/.scriptforge/settings.json` only for small application preferences.
- Preserve Forge candidates across restarts. Delete temporary job inputs and outputs older than 24 hours during startup.
- Use one publishable `scriptforge` package containing the CLI, Hono server, React/Vite application, and built web assets. Use pnpm for development while keeping `npx scriptforge` npm-compatible.
- Before starting Forge, show a GeckoUI dialog with model and reasoning-effort selects. Store those two UI preferences in browser `localStorage`, not `settings.json`.
- Available library cards navigate as one accessible click target. Forge-saved and imported cards use a compact actions menu; their detail header uses tooltip-labeled icon actions for Export and Delete. Bundled cards and detail pages omit those management actions.
- Default to `gpt-5.6-sol` with `medium` reasoning effort. Offer `gpt-5.6-terra`, `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.3-codex`, and `gpt-5.2` as additional model choices, subject to the installed Codex CLI and account.
- Offer `minimal`, `low`, `medium`, `high`, and `xhigh` effort choices.
- Check that Codex CLI exists and is authenticated before Forge starts. If not, keep the library usable and show installation/login guidance plus Retry. Never install or authenticate Codex automatically.

## Safety Contract

1. Codex may create and modify candidate files only inside a dedicated staging directory before Save.
2. Do not launch Codex with `--dangerously-bypass-approvals-and-sandbox` unless the user explicitly enables the off-by-default Forge preflight option. Remember that preference only in browser local storage and clearly surface its risk.
3. Generating files in staging does not authorize executing them.
4. Starting a Forge session authorizes Codex to run bounded standalone checks of the candidate inside staging. Codex asks questions only when unresolved decisions materially affect the tool; a separate kickoff approval is not required. Dependency installation remains a separate explicit action by default. If the user explicitly enabled the warned Forge permission-bypass option before starting the session, dependencies genuinely needed to build and test that candidate are pre-authorized and Codex should attempt suitable installation without asking again. Saving a tool always remains a separate explicit user-controlled action.
5. Installation commands are generated for the current machine at run time; they are never embedded in a shared or local tool manifest.
   Before Forge runs or Doctor proposes an installation, it must verify through read-only package metadata that the exact package exists and supplies the required executable on the current platform. Website, GitHub, raw-file, release, and other download URLs must likewise be verified against the intended pinned upstream before use.
6. Executable declarations drive readiness checks and Doctor guidance but do not sandbox the runner. Review the runner source before Save because installed runners execute with the current operating-system user's permissions.
7. Generated browser code runs unsandboxed and same-origin with network and ScriptForge API access. Browser JavaScript remains limited only by the browser platform itself; `run.mjs` has normal Node.js filesystem, process, and network access.
8. Review and save the exact candidate revision that was tested; detect changes made after review.
9. Any script change invalidates the previous successful test status.
10. Redact secrets, environment values, and unsafe filesystem details from logs before sending them to browser code.
11. A generated iframe never collects or receives persistent secrets. Known saved secret values must be redacted from runner logs, errors, result data, and metadata before delivery.
12. Tools may read, create, modify, move, or delete files anywhere the current operating-system user can access. In-place workflows should act on the requested files directly instead of forcing copied inputs or replacement ZIP downloads.
13. Destructive tools must still show the exact affected items or count and obtain explicit confirmation immediately before deletion or overwrite. Prefer the operating-system Trash when the requested workflow allows recovery.

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
14. Tool packages contain `tool.json`, their execution files, and `ui.html`; do not generate separate test files inside a tool. After any necessary questions are resolved, Codex must exercise the standalone runner with realistic temporary input, fix failures, rerun it, and report the successful check before presenting the candidate. The exact candidate revision is then tested through an explicit user-approved run in the unrestricted tester iframe before Save. Keep automated tests focused on ScriptForge's host bridge, runner, validation, and trust boundaries.
15. Style the React ScriptForge shell with Tailwind utility classes directly in components. Keep global CSS limited to imports, design tokens, base element rules, and targeted GeckoUI theme overrides. Self-contained tool `ui.html` files may use ordinary CSS classes and do not depend on Tailwind.
16. Build manifest-driven configuration forms with the same React Hook Form, Zod, and GeckoUI rules as other application forms. Secret fields never have defaults, are never prefilled after saving, and remain unchanged when an empty replacement is submitted.
17. Keep icon, badge, and avatar layout selectors isolated from descendant typography selectors. Never use a broad rule such as `.card span` when the component also contains a span-based icon wrapper; give the text wrapper a dedicated class and verify that every glyph remains horizontally and vertically centered after the full cascade is applied.

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
