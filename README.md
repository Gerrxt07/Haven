# Haven

Haven is a desktop communication app in active development, built with Electron, SolidJS, TypeScript, Vite, and Bun.

The repository includes:

- Electron main/preload process code
- SolidJS renderer UI
- Build, packaging, and runtime hardening scripts

## Current Status

Haven is pre-release software.

- Features and APIs may change
- Some functionality is still under construction
- Production deployment is not recommended yet

## Technology Stack

- **Runtime & package manager:** Bun
- **Desktop shell:** Electron
- **Frontend:** SolidJS
- **Build tooling:** Vite
- **Language:** TypeScript
- **Packaging:** electron-builder
- **Code quality:** Biome, TypeScript, Knip, CSpell, Vitest

## Architecture Overview

Haven follows Electron process isolation:

- **Main process** (`electron/main.ts`): window lifecycle, permissions, CSP, secure IPC handlers
- **Preload bridge** (`electron/preload.ts`): minimal `contextBridge` API exposed to renderer
- **Renderer** (`src/`): UI and interaction logic

Security-sensitive operations (window controls, URL opening, token storage) are mediated through IPC and sender validation.

## Security Highlights

The current implementation includes defense-in-depth controls such as:

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- strict trusted-origin checks for navigation and permissions
- CSP headers injected from the main process
- external link interception with explicit user confirmation flow
- secure token encryption using Electron `safeStorage`
- blocked dangerous CLI flags (`--inspect`, `--remote-debugging-port`, etc.)
- packaged runtime hardening via Electron fuses
- build integrity manifest generation (`dist-electron/integrity.json`)

## Prerequisites

- Bun (latest stable)
- Node.js (needed by parts of the Electron/build toolchain)
- Windows, macOS, or Linux

## Quick Start

Install dependencies:

```bash
bun install
```

Run development:

```bash
bun run dev
```

> Note: `dev` runs the full quality gate first (`check`) before launching Vite.

## Available Scripts

### Quality and Validation

- `bun run typecheck` — TypeScript check (`tsc --noEmit`)
- `bun run format` — apply Biome formatting/fixes
- `bun run lint` — Biome checks
- `bun run knip` — unused files/dependencies analysis
- `bun run spellcheck` — CSpell over source/docs
- `bun run test` — Vitest test run
- `bun run check` — format + typecheck + knip + spellcheck + husky + test

### Development and Build

- `bun run dev` — run full checks, then start Vite dev mode
- `bun run build` — run checks, then create production build

### Packaging and Protection

- `bun run build:bytecode` — compile selected Electron output to bytecode
- `bun run build:integrity` — generate SHA-256 integrity manifest
- `bun run protect` — run bytecode + integrity steps
- `bun run package:win` — build, protect, and package for Windows
- `bun run package:mac` — build, protect, and package for macOS
- `bun run package:linux` — build, protect, and package for Linux

## Project Structure

- `electron/` — Electron entrypoints (`main.ts`, `preload.ts`)
- `src/` — SolidJS renderer application
- `src/views/` — route/view components
- `src/types/` — shared renderer-side typings
- `public/` — static assets
- `scripts/` — packaging hardening scripts (fuses, bytecode, integrity)
- `dist/` — renderer build output
- `dist-electron/` — Electron build output
- `release/` — packaged artifacts

## Build and Release Notes

Packaging is configured through `package.json` (`build` section) and outputs to `release/`.

Post-build hardening pipeline:

1. compile selected Electron files to bytecode
1. generate integrity manifest for runtime assets
1. flip Electron fuses during `afterPack`

## Contributing

Contributions are welcome during active development.

Recommended workflow:

1. Create a feature branch
1. Keep changes modular and process-safe (main/preload/renderer separation)
1. Run local checks:

```bash
bun run check
```

1. Open a PR with clear rationale and security impact (if relevant)

## Troubleshooting

### `bun run dev` is slow to start

This is expected: it runs `check` before launching the app.

### Packaging fails

Ensure both renderer and Electron outputs exist, then rerun:

```bash
bun run protect
```

### Integrity manifest issues

Verify `dist/` and `dist-electron/` are generated before `build:integrity`.

## License

Haven is distributed under the Haven Source Available License (Haven-SAL) v1.0.

See [LICENSE](LICENSE) for full terms.
