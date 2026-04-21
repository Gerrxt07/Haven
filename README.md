<div align="center">
  <h1>Haven</h1>
  <p><b>A security-first desktop chat platform with a hardened Electron client and Rust backend.</b></p>

  <p>
    <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-black?logo=bun&style=flat-square" alt="Bun"></a>
    <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-191970?logo=electron&logoColor=white&style=flat-square" alt="Electron"></a>
    <a href="https://www.solidjs.com/"><img src="https://img.shields.io/badge/SolidJS-2c4f7c?logo=solid&logoColor=white&style=flat-square" alt="SolidJS"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Haven--SAL%20v1.0-blue?style=flat-square" alt="License"></a>
  </p>
</div>

---

## Overview

**Haven** is the desktop client for the Haven communication stack. It is built around a defense-in-depth model: the Electron shell is locked down aggressively, the renderer talks to the OS only through a minimal preload bridge, and the backend uses modern authentication, encrypted data handling, and strict realtime controls.

> **Status: Pre-release**
> APIs, UI flows, and deployment details are still evolving. Expect breaking changes while the platform matures.

## Security Architecture

Haven is designed as a full platform, not just a UI shell. The client and backend both carry security responsibilities.

### Desktop client protections

- **Strict process isolation:** `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
- **Minimal preload bridge:** Renderer access to native capabilities is exposed only through explicit `contextBridge` APIs.
- **Sender-validated IPC:** Sensitive IPC routes for tokens, secure storage, external links, and window controls validate the calling sender.
- **Encrypted local secrets:** Access and refresh tokens are protected with Electron `safeStorage` and the app's secure-store layer.
- **Zero-trust navigation:** The main process restricts navigation, window creation, permission requests, and external URL handling to trusted paths.
- **Hardened runtime flags:** Dangerous debug and sandbox-bypass flags such as `--inspect`, `--remote-debugging-port`, and `--no-sandbox` are actively blocked.
- **Build integrity pipeline:** Integrity manifests are generated for packaged runtime assets during the build flow.
- **Secure updater posture:** The updater window uses the same hardened browser settings as the main window.

### Backend protections exposed through the client

- **SRP login handshake:** Passwords are not sent in plaintext during the primary login flow; the client performs SRP challenge-response authentication.
- **PASETO session tokens:** Auth uses access and refresh tokens built on `PASETO v4 local`.
- **Optional 2FA:** The backend supports TOTP and backup-code verification flows.
- **Encrypted PII handling:** Sensitive backend data uses authenticated encryption and blind indexes for lookup-sensitive fields such as email.
- **Per-route and per-identity throttling:** Login and verification flows are rate-limited both globally and per account identity.
- **Strict request validation:** The backend enforces cursor validation, payload validation, request body limits, and account-status checks.
- **Secure WebSocket auth:** The client now authenticates the socket with an explicit first `authenticate` message instead of putting bearer tokens in query parameters.
- **Server-enforced realtime identity:** Clients no longer send `user_id` in websocket commands; the backend derives identity from the verified token.
- **Realtime abuse protection:** Per-connection websocket message throttling and E2EE payload size caps reduce message flooding and oversized ciphertext attacks.
- **Redis-backed fanout:** Realtime events are distributed through Redis Pub/Sub to support multi-node fanout without trusting local-only event delivery.
- **Privacy cleanup:** Soft-deleted backend accounts are later anonymized automatically to support privacy retention goals without breaking chat history structure.

> If you are reviewing Haven from a security angle, also see [SECURITY.md](./SECURITY.md) and [HACK_THE_APP.md](./HACK_THE_APP.md).

## Product Capabilities

- Account registration and authenticated sessions
- SRP login with refresh-token rotation
- Email verification and optional two-factor authentication
- Friends, direct messages, channels, and servers
- End-to-end encryption key-bundle workflows
- Presence and realtime websocket updates
- Local avatar caching and secure token persistence
- Electron packaging, update, and integrity tooling

## Technology Stack

- **Runtime and package manager:** [Bun](https://bun.sh)
- **Desktop shell:** [Electron](https://www.electronjs.org/)
- **Frontend UI:** [SolidJS](https://www.solidjs.com/)
- **Language:** TypeScript
- **Build tooling:** Vite, electron-builder
- **Quality tooling:** Biome, Husky, Knip

## Getting Started

### Prerequisites

- [Bun](https://bun.sh)
- Node.js
- A reachable Haven backend instance

### Install

```bash
git clone https://github.com/Gerrxt07/Haven.git
cd Haven
bun install
```

### Run in development

```bash
bun run dev
```

### Quality gate

```bash
bun run check
```

## Scripts

### Quality

| Command | Description |
| :--- | :--- |
| `bun run format` | Apply Biome formatting and safe auto-fixes. |
| `bun run lint` | Run Biome checks across the repo. |
| `bun run typecheck` | Run `tsc --noEmit`. |
| `bun run test` | Run the Bun test suite. |
| `bun run knip` | Detect unused files and dependencies. |
| `bun run check` | Run formatting, tests, typecheck, and repo prep tasks. |

### Build and package

| Command | Description |
| :--- | :--- |
| `bun run build` | Build the renderer and Electron bundles after checks. |
| `bun run build:integrity` | Generate integrity metadata for packaged assets. |
| `bun run package:win` | Build and package for Windows. |
| `bun run package:mac` | Build and package for macOS. |
| `bun run package:linux` | Build and package for Linux. |

## Project Structure

```text
Haven/
|-- electron/              Electron main process, preload bridge, updater, secure logging
|-- src/                   SolidJS renderer application
|   |-- lib/               API clients, auth, realtime, E2EE, cache, stores
|   |-- views/             Main application views
|   `-- components/        Shared UI components
|-- public/                Static application assets
|-- scripts/               Build and hardening scripts
|-- dist/                  Built renderer output
|-- dist-electron/         Built Electron output
`-- release/               Packaged release artifacts
```

## Related Repositories

- Client: this repository
- Backend: [Haven_Backend](../Haven_Backend)

## Contributing

1. Create a feature branch.
2. Keep Electron main-process, preload, and renderer responsibilities separated.
3. Run `bun run check` before opening a PR.
4. If your change affects IPC, auth, storage, or transport behavior, include the security impact in the PR description.

## License

Haven is distributed under the **Haven Source Available License (Haven-SAL) v1.0**. See [LICENSE](./LICENSE).
