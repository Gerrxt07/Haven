# Haven

Haven is a desktop communication app in active development, built with Tauri, Rust, SolidJS, TypeScript, Vite, and Bun.

The repository includes:

- Tauri/Rust desktop shell code
- SolidJS renderer UI
- Desktop build and packaging configuration

## Current Status

Haven is pre-release software.

- Features and APIs may change
- Some functionality is still under construction
- Production deployment is not recommended yet

## Technology Stack

- **Runtime & package manager:** Bun
- **Desktop shell:** Tauri 2 + Rust
- **Frontend:** SolidJS
- **Build tooling:** Vite
- **Languages:** TypeScript, Rust
- **Packaging:** Tauri bundler
- **Code quality:** Biome, TypeScript, Knip, husky

## Architecture Overview

Haven uses a Tauri split architecture:

- **Native shell** (`src-tauri/src/lib.rs`): window lifecycle, tray behavior, secure storage, logging, DNS validation, updater settings, and native desktop commands
- **Renderer** (`src/`): SolidJS UI and interaction logic
- **Frontend native adapter** (`src/lib/native/`): typed bridge from the renderer to Tauri commands and events

Security-sensitive operations such as window controls, URL opening, token storage, and secure cache persistence are mediated through Tauri commands instead of Electron preload globals.

## Security Highlights

The current implementation includes defense-in-depth controls such as:

- Rust-owned native command surface for desktop-sensitive actions
- secure OS-backed credential storage through the native layer
- typed event bridge for window state updates
- explicit external URL opening through the native opener plugin
- tray-based restore/minimize lifecycle managed in the Tauri shell

## Prerequisites

- Bun
- Rust toolchain
- Platform-specific Tauri prerequisites for WebView/WebKit
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

This starts the Vite dev server and the Tauri shell together.

## Available Scripts

### Quality and Validation

- `bun run typecheck` - TypeScript check (`tsc --noEmit`)
- `bun run format` - apply Biome formatting and fixes
- `bun run lint` - Biome checks
- `bun run knip` - unused files and dependencies analysis
- `bun run test` - Bun test run
- `bun run check` - format and typecheck

### Development and Build

- `bun run dev` - start the Tauri desktop app in development
- `bun run dev:web` - start only the Vite dev server used by Tauri
- `bun run build:web` - run checks, then build the frontend
- `bun run build` - build the frontend and the Tauri desktop app
- `bun run package:win` - build Windows bundles
- `bun run package:mac` - build macOS bundles
- `bun run package:linux` - build Linux bundles

## Project Structure

- `src/` - SolidJS renderer application
- `src/lib/native/` - typed Tauri adapter used by the renderer
- `src/views/` - route and view components
- `src-tauri/` - Tauri config, permissions, icons, and Rust app code
- `public/` - static assets
- `dist/` - renderer build output
- `src-tauri/target/` - Rust and Tauri build output

## Build and Release Notes

Packaging is configured through `src-tauri/tauri.conf.json` and the Tauri CLI.

## Contributing

Recommended workflow:

1. Create a feature branch.
2. Keep changes modular across native shell and renderer boundaries.
3. Run local checks:

```bash
bun run typecheck
cargo check --manifest-path src-tauri/Cargo.toml
```

## Troubleshooting

### Packaging fails

Ensure both Rust and frontend dependencies are installed, then rerun:

```bash
bun run build
```

## License

Haven is distributed under the Haven Source Available License (Haven-SAL) v1.0.

See [LICENSE](LICENSE) for full terms.
