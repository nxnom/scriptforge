# ScriptForge

ScriptForge is a local app store where small utility apps do not exist until you ask Codex to forge them.

**OpenAI Build Week track:** Apps for your life

## Status

The local application shell and typed API foundation are working. The image-resizer workflow, Forge, dependency Doctor, and submission assets are being built milestone by milestone.

## Key Features

- Local-only Hono server and React library launched from one CLI package
- GeckoUI application shell based on the checked-in Pencil design
- Hono-to-Spoosh inferred REST types with caching, deduplication, invalidation, retry, refetch, and cache cleanup
- Preferred `127.0.0.1:4545` address with automatic port fallback
- Planned embedded Codex TUI, staged tool generation, explicit approvals, structured logs, and dependency Doctor

## Prerequisites

- Node.js 20 or newer
- pnpm 10 for development

Codex CLI is not required for the starter library. It will be required for the Forge workflow in a later milestone.

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
pnpm lint
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
- REST handles request/response operations; WebSocket will handle terminal and job streams.

## Environment Variables

None are required for the current milestone. Never commit OpenAI credentials or Codex authentication data.

## Sample Data

The current server provides a small built-in tool catalog. The first functional tool will be the bundled image resizer powered by `sharp`.

## Build Week Evidence

- **Track:** Apps for your life — ScriptForge lets people create focused local utilities for everyday files and workflows.
- **GPT-5.6 model:** The planned Forge preflight defaults to `gpt-5.6-sol`; the exact configuration will be implemented and verified in Goal 3.
- **GPT-5.6-powered features:** On-demand tool forging, dependency diagnosis, and plain-language review are planned for Goals 3 and 4.
- **Codex acceleration:** Codex helped define the safety model, inspect the Pencil design, configure the typed Hono/Spoosh boundary, implement the local shell, and write verification tests.
- **Key decisions:** Filesystem manifests instead of a database; localhost-only server; contextual Forge side panel; generated HTML isolated in a sandboxed iframe; explicit execution and installation approval.
- **Verification:** TypeScript typecheck, API and port-selection tests, production builds, live local HTTP checks, and npm package dry runs.
- **Primary Codex Session ID:** `TBD — obtain with /feedback before submission`.

## Limitations and Future Work

- The image-resizer interaction is not implemented yet.
- Forge and Doctor are not implemented yet.
- Import/export sharing is intentionally postponed until after the hackathon MVP.
- macOS is the first supported platform; Windows and Linux should fail clearly where a capability is unavailable.

## License and Acknowledgements

A project license will be selected before publishing the judging repository. Built with OpenAI Codex, GPT-5.6, Hono, React, GeckoUI, and Spoosh.
