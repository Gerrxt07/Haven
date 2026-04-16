<div align="center">
  <h1>Haven</h1>
  <p><b>A security-first, high-performance desktop communication platform.</b></p>

  <p>
    <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-black?logo=bun&style=flat-square" alt="Bun"></a>
    <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-191970?logo=electron&logoColor=white&style=flat-square" alt="Electron"></a>
    <a href="https://www.solidjs.com/"><img src="https://img.shields.io/badge/SolidJS-2c4f7c?logo=solid&logoColor=white&style=flat-square" alt="SolidJS"></a>
    <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript"></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Haven--SAL%20v1.0-blue?style=flat-square" alt="License"></a>
  </p>
</div>

---

## 📖 Overview

**Haven** is a desktop communication app currently in active development. Engineered as a highly hardened alternative to standard Electron apps, Haven prioritizes user privacy, robust process isolation, and blazing-fast performance.

> **⚠️ Current Status: Pre-Release**
> Haven is currently in active development. Features, APIs, and underlying structures are subject to change. It is not yet recommended for production deployment.

## 🛡️ Security Highlights

Haven does not treat security as an afterthought. The application architecture leverages a strict defense-in-depth model, specifically engineered to mitigate common desktop application vulnerabilities:

* **Strict Process Isolation:** `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`.
* **Zero-Trust Navigation:** Strict trusted-origin checks for all navigation and permission requests.
* **Hardened IPC:** Security-sensitive operations (window controls, URL opening, token storage) are exclusively mediated through secure, sender-validated IPC channels.
* **Encrypted Storage:** Secure local token encryption utilizing Electron's native `safeStorage`.
* **Runtime Protection:** Electron fuses are flipped to block dangerous CLI flags (e.g., `--inspect`, `--remote-debugging-port`).
* **Build Integrity:** Automated generation of SHA-256 integrity manifests (`dist-electron/integrity.json`) during the build pipeline.

> **Are you a security researcher or reverse engineer?**
> Check out the [**"Hack-The-App" Challenge**](./HACK_THE_APP.md) and review my [**Security Policy**](./SECURITY.md) for responsible disclosure rules!

## ⚡ Technology Stack

Haven is built on a modern, deeply optimized stack to ensure a lightweight footprint and maximum speed:

* **Runtime & Package Manager:** [Bun](https://bun.sh/)
* **Desktop Shell:** [Electron](https://www.electronjs.org/)
* **Frontend UI:** [SolidJS](https://www.solidjs.com/) (Reactive, Virtual-DOM-less rendering)
* **Build Tooling:** [Vite](https://vitejs.dev/) & [electron-builder](https://www.electron.build/)
* **Language:** TypeScript
* **Code Quality:** Biome, Knip, Husky

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system (Windows, macOS, or Linux):
- **[Bun](https://bun.sh/)** (Latest stable version)
- **Node.js** (Required for specific Electron/build toolchain compatibility)

### Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/yourusername/haven.git](https://github.com/yourusername/haven.git)
   cd haven
   ```

2.  Install dependencies:

    ```bash
    bun install
    ```

3.  Start the development environment:

    ```bash
    bun run dev
    ```

    *Note: The `dev` command automatically runs a full quality gate (`check`) before launching Vite to ensure code integrity. It may take a few seconds longer to boot.*

## 🛠️ Development Workflow & Scripts

The project utilizes `bun` for all script execution. Below are the primary commands available in the `package.json`.

### Quality Assurance

| Command | Description |
| :--- | :--- |
| `bun run typecheck` | Validates TypeScript typings (`tsc --noEmit`). |
| `bun run format` | Applies Biome code formatting and auto-fixes. |
| `bun run lint` | Runs Biome static analysis checks. |
| `bun run knip` | Analyzes the workspace for unused files or dependencies. |
| `bun run test` | Executes the Vitest test suite. |
| `bun run check` | **Full CI Gate:** Runs format, typecheck, knip, husky, and tests. |

### Build & Packaging

| Command | Description |
| :--- | :--- |
| `bun run build` | Runs quality checks, then creates the production UI and Electron build. |
| `bun run build:integrity`| Generates the SHA-256 integrity manifest for runtime assets. |
| `bun run protect` | Standalone command to execute the post-build hardening pipeline. |

**Platform Specific Packaging:**
Outputs are generated in the `release/` directory.

  * `bun run package:win`
  * `bun run package:mac`
  * `bun run package:linux`

*Troubleshooting Packaging:* If packaging fails, ensure both `dist/` (renderer) and `dist-electron/` (main process) directories exist, then run `bun run protect` before retrying.

## 🏗️ Architecture & Project Structure

The codebase is strictly separated into Node.js (Main) and Browser (Renderer) environments:

```
haven/
├── electron/              # Electron backend
│   ├── main.ts            # Window lifecycle, permissions, CSP, secure IPC handlers
│   └── preload.ts         # Minimal contextBridge API exposed to the renderer
├── src/                   # SolidJS frontend
│   ├── views/             # Route and view components
│   └── types/             # Shared TypeScript interfaces
├── public/                # Static assets (icons, fonts)
├── scripts/               # Build and security hardening scripts
├── dist/                  # Output: Compiled renderer UI
├── dist-electron/         # Output: Compiled Electron main/preload
└── release/               # Output: Final packaged OS executables
```

## 🤝 Contributing

Contributions are welcome\! Since Haven relies heavily on strict process isolation, please adhere to the following workflow:

1.  Fork the repository and create a feature branch.
2.  Keep your changes modular. Respect the boundary between `main`, `preload`, and `renderer`.
3.  Validate your changes locally by running `bun run check`.
4.  Open a Pull Request. If your changes affect IPC, dependencies, or permissions, please include a brief security rationale.

## ⚖️ License

Haven is distributed under the **Haven Source Available License (Haven-SAL) v1.0**.  
Please review the [LICENSE](https://www.google.com/search?q=./LICENSE) file for full terms, conditions, and usage restrictions.
