# ScriptForge

ScriptForge is a local app store where small utility apps do not exist until you ask Codex to forge them.

**OpenAI Build Week track:** Apps for your life

## Status

The local application shell, typed API foundation, bundled image-resizer workflow, and Forge preflight are working. The interactive Forge terminal, dependency Doctor, and submission assets are being built milestone by milestone.

## Key Features

- Local-only Hono server and React library launched from one CLI package
- GeckoUI application shell based on the checked-in Pencil design
- Hono-to-Spoosh inferred REST types with caching, in-flight deduplication, and automatic invalidation
- Preferred `127.0.0.1:4545` address with automatic port fallback
- Sandboxed plain-HTML tool interfaces connected to a controlled host bridge
- Bundled Sharp image resizer with progress, structured logs, before/after previews, and local result download
- Codex CLI installation/authentication preflight with locally remembered model and effort choices
- Planned embedded Codex TUI, staged tool generation, explicit approvals, and dependency Doctor

## Prerequisites

- Node.js 20 or newer
- pnpm 10 for development

Codex CLI is not required for the starter library. Forge checks for it and shows manual installation and login guidance without changing the machine automatically.

## Setup

```bash
pnpm install
pnpm dev
```

The development UI opens through Vite and proxies typed API calls to the local Hono server on port 4545.

## Build and Run

```bash
pnpm build
node dist/cli.js
```

The production CLI opens ScriptForge in the default browser. Pass `--no-open` when running it in an automated environment.

## Verification

```bash
pnpm check
pnpm lint
pnpm format
pnpm typecheck
pnpm test
pnpm build
pnpm pack --dry-run
```

## Architecture

The repository is one publishable npm package:

- `src/cli.ts` selects the local port, starts Hono, and opens the browser.
- `src/server` contains the local API and server utilities.
- `src/web` contains the React and GeckoUI application.
- Hono route types flow into Spoosh without a handwritten API schema.
- REST handles request/response operations; WebSocket handles job events and will also carry Forge terminal streams.
- Bundled and generated tools share a manifest, `run.mjs`, and sandboxed `ui.html` runtime contract.

## Environment Variables

None are required for the current milestone. Never commit OpenAI credentials or Codex authentication data.

## Sample Data

The bundled image resizer accepts a local PNG, JPEG, or WebP file, so no separate sample dataset is required. It is powered by `sharp` and requires no system executable.

## Build Week Evidence

- **Track:** Apps for your life — ScriptForge lets people create focused local utilities for everyday files and workflows.
- **GPT-5.6 model:** The Forge preflight defaults to `gpt-5.6-sol` in `src/web/forge/preferences.ts`; the selected model will be passed explicitly when the Goal 3 terminal launcher is connected.
- **GPT-5.6-powered features:** On-demand tool forging, dependency diagnosis, and plain-language review are planned for Goals 3 and 4.
- **Codex acceleration:** Codex helped define the safety model, inspect the Pencil design, configure the typed Hono/Spoosh boundary, implement the local shell and generic tool runtime, diagnose the sandbox bridge, and write verification tests.
- **Key decisions:** Filesystem manifests instead of a database; localhost-only server; contextual Forge side panel; generated HTML isolated in a sandboxed iframe; transferable file descriptors across the host bridge; explicit execution and installation approval.
- **Verification:** Biome checks, TypeScript typecheck, eleven automated host/API tests, production builds, live local HTTP, Codex-readiness and CSP checks, npm package dry runs, and a manual image resize/preview/download acceptance run.
- **Primary Codex Session ID:** `019f7198-5cb2-74b2-96a8-c8909989d1b2`.

## Limitations and Future Work

- The Forge terminal and candidate workflow are not connected yet; the preflight is working.
- Dependency Doctor is not implemented yet.
- Import/export sharing is intentionally postponed until after the hackathon MVP.
- macOS is the first supported platform; Windows and Linux should fail clearly where a capability is unavailable.

## License and Acknowledgements

A project license will be selected before publishing the judging repository. Built with OpenAI Codex, GPT-5.6, Hono, React, GeckoUI, and Spoosh.
