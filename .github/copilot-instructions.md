Autonomous Agent Instructions: Electron/Bun/TS
1. Mandatory Tool Sequencing
The agent must follow this execution flow for every request:

sequentialthinking: Process the prompt to map out the Electron Main vs. Renderer process impacts. Identify if a task requires Bun’s native APIs (like Bun.sqlite or Bun.file).

context7: Scan the project to ensure new modules don't duplicate existing logic and adhere to the established TypeScript interfaces.

playwright: After implementation, the agent must autonomously verify the UI state or bridge communication if the change affects the frontend.

2. Architecture & Performance Standards
Runtime: Maximize Bun’s capabilities. Use Bun built-ins for file I/O and HTTP instead of heavier node-module alternatives.

Process Isolation: Maintain strict separation between the Main process and Renderer. All communication must happen via secure IPC patterns.

Modularization: * No "God Files." Every utility, IPC handler, and UI component must reside in its own file.

Use Barrel files (index.ts) for clean exports.

Performance: * Minimize the Electron main process footprint.

Use lazy loading for heavy modules.

Target zero-copy operations when moving data between Bun and the Electron window.

Architecture Tip: A simulation requires a fixed "tick" (game loop). Run all of this tick logic (train movements, signal status updates) exclusively in the renderer process (or even in a Web Worker within the renderer).

Do not communicate every train tick to the main process via IPC. According to the specifications, the main process (Bun) should only be used for system-related tasks, such as saving the current network to a file using your storage.ts functions.

3. Structural Constraints
Strict Typing: No any. Use discriminated unions for IPC event payloads to ensure type safety across the bridge.

No Chat/Tests: Do not output code blocks in the chat interface or generate test files unless specifically asked. Focus purely on the filesystem implementation.

Direct Interaction: The agent should use filesystem tools to write/update files directly rather than describing the changes.

4. GitHub Actions & Security
Workflows: Place CI/security workflows only in .github/workflows and keep them minimal.

Permissions: Use least-privilege permissions in workflows (explicit permissions block).

Action Versions: Pin actions to major versions (e.g., @v4) and let Dependabot manage updates.

CodeQL: Prefer CodeQL for JS/TS security scanning when adding security checks.

5. Dependabot
Ecosystems: Maintain Dependabot entries for npm and github-actions at the repository root.

Labels: Use the "dependencies" label for automated update PRs.

Recommended Project Structure
The agent should maintain and respect this hierarchy:

Directory,Responsibility
src/main/ - Electron main process logic (Bun runtime).
src/preload/ - Context-isolated IPC bridges.
src/renderer/ - UI components and frontend logic.
src/shared/ - Shared TypeScript types and constants.
src/lib/ - High-performance modular utilities.

