# Haven

Haven is a work-in-progress desktop voice/video/chat application built with Electron, Bun, Vite, and SolidJS.

This repository contains both:

- renderer UI code (SolidJS)
- Electron main/preload process code

## Status

Haven is under active development.

- APIs and internals may change
- features are incomplete
- production use is not recommended yet

## Tech Stack

- Bun (runtime + package manager)
- TypeScript
- Vite
- SolidJS
- Electron

## Prerequisites

- Bun (latest stable)
- Node.js (required by some build tooling)
- Windows/macOS/Linux

## Getting Started

Install dependencies:

```bash
bun install
```

Run in development mode:

```bash
bun run dev
```

Run development mode with full checks before start:

```bash
bun run dev:strict
```

## Scripts

- `bun run dev` - start app in development mode (fast startup)
- `bun run dev:strict` - run lint/typecheck, then start development mode
- `bun run typecheck` - TypeScript check (`tsc --noEmit`)
- `bun run lint` - ESLint
- `bun run check` - typecheck + lint
- `bun run build` - production build (includes checks)
- `bun run package` - build + protection steps + package app
- `bun run package:win` - package for Windows
- `bun run package:mac` - package for macOS
- `bun run package:linux` - package for Linux
- `bun run build:bytecode` - compile selected JS to bytecode
- `bun run build:integrity` - generate integrity manifest
- `bun run protect` - bytecode + integrity steps

## Security Notes

Haven includes hardening in the desktop runtime, including:

- strict Electron bridge via preload and context isolation
- origin checks for media permission requests
- external URL protocol validation (`http/https` only)
- Content Security Policy enforcement from the main process
- Electron fuse hardening and ASAR integrity validation in packaged builds

These controls are defense-in-depth and do not replace secure coding practices.

## Project Structure

- `electron/` - Electron main and preload source
- `src/` - renderer app source
- `public/` - static assets
- `scripts/` - build and protection scripts
- `dist/` - renderer build output
- `dist-electron/` - Electron build output

## Contributing

Contributions are welcome while Haven is in active development.

Basic workflow:

1. Fork the repository and create a feature branch.
1. Keep changes focused and modular.
1. Run checks locally before opening a PR:

```bash
bun run check
```

1. Describe what changed, why it changed, and any security impact.

Guidelines:

- Prefer strict typing; avoid `any`.
- Keep Electron main, preload, and renderer concerns separated.
- Do not bypass security controls (CSP, URL validation, permission checks).
- Update docs when behavior or scripts change.

## Build / Release Troubleshooting

### Development startup is slow

- Use `bun run dev` for fast startup.
- Use `bun run dev:strict` only when you explicitly want pre-start checks.

### Lint/type errors block builds

- Run `bun run check` and fix reported TypeScript/ESLint issues.
- Ensure local Bun and Node versions are up to date.

### Packaging issues

- Run full packaging pipeline:

```bash
bun run package
```

- Platform-specific packaging:
  - `bun run package:win`
  - `bun run package:mac`
  - `bun run package:linux`

### Bytecode/integrity related failures

- Re-run protection steps directly:

```bash
bun run protect
```

- Confirm output paths exist (`dist/`, `dist-electron/`) before protection scripts run.

### Electron hardening not applied in release

- Verify fuse script is present in [scripts/apply-electron-fuses.cjs](scripts/apply-electron-fuses.cjs).
- Verify packaging hook configuration in [package.json](package.json) under `build.afterPack`.

## License

Haven is distributed under the Haven Source Available License (Haven-SAL) v1.0.

- Source is public for transparency and collaboration.
- The project is source-available and open-source-minded.
- It is not an OSI-approved open source license.

See [LICENSE](LICENSE) for full terms.
