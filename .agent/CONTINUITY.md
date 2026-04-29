# CONTINUITY

2026-04-21T10:29:00+02:00 [TOOL] `UNCONFIRMED` missing file at `.agent/CONTINUITY.md`; created baseline memory file for repo continuity.
2026-04-21T10:32:38+02:00 [USER] Update client for backend WebSocket auth/protocol changes, bump client version to today, then commit and push after tests.
2026-04-21T10:32:38+02:00 [CODE] Updated realtime client to authenticate via first WebSocket message instead of query token, removed client-sent `user_id` from join/presence/broadcast messages, added in-memory auth session test helpers, updated WS integration tests, and bumped app version to `2026.4.21`.
2026-04-21T10:32:38+02:00 [TOOL] Verified with `bun test`, `bun run typecheck`, and targeted `bunx biome check` on touched files; repo-wide `bun run lint` still fails from unrelated pre-existing formatting issues outside this change.
2026-04-21T10:38:34+02:00 [USER] Fix the client linting issues.
2026-04-21T10:38:34+02:00 [CODE] Applied repo-wide Biome formatting fixes to eliminate lint failures across Electron, API, view, store, and test files.
2026-04-21T10:38:34+02:00 [TOOL] Verified green with `bun run lint`, `bun test`, and `bun run typecheck`.
2026-04-21T10:38:34+02:00 [USER] Update the client README with all app/backend security features and redesign the backend README in the same modern style.
2026-04-21T10:38:34+02:00 [CODE] Rewrote the client README with a full platform-security section covering Electron hardening plus backend protections, product capabilities, and cleaner setup docs.
2026-04-21T10:38:34+02:00 [TOOL] Verified client docs change under existing repo checks with `bun run lint`.
2026-04-22T20:58:00+02:00 [USER] Review Dependabot PRs #35 and #36, improve them if possible, and update the repo package set locally.
2026-04-22T20:58:00+02:00 [CODE] Updated `electron` to `42.0.0-beta.4`, `eslint` to `10.2.1`, `typescript` to `6.0.3`, `@tanstack/solid-virtual` to `3.13.24`, and improved beyond PR #35 by taking `@tanstack/solid-query` to `5.99.2`; refreshed `bun.lock`.
2026-04-22T20:58:00+02:00 [TOOL] `bun install` succeeded after sandbox escalation for tempdir access; `bun run typecheck` passed.
2026-04-22T21:15:00+02:00 [CODE] Applied Biome formatting fixes to `src/lib/auth/session.ts`, `src/lib/realtime/manager.ts`, and `src/lib/tests/ws.integration.test.ts` to restore repo lint cleanliness.
2026-04-22T21:15:00+02:00 [TOOL] Verified green with `bun run lint`, `bun run typecheck`, and `bun test`; Bun tests needed sandbox escalation because in-sandbox module resolution for `solid-js/store` and `libsodium-sumo` was unreliable.
2026-04-22T19:05:11.5422930+02:00 [USER] Investigate issue #27 where the post-update popup opens but shows no changelog information, then fix and commit it.
2026-04-22T19:05:11.5422930+02:00 [CODE] Moved changelog GitHub fetching from renderer to Electron main-process IPC, kept updater obfuscation names reserved, and added an empty-state GitHub fallback button for the update modal.
2026-04-22T19:05:11.5422930+02:00 [TOOL] Root cause was renderer CSP blocking `https://api.github.com`; verified fix with `bun run typecheck`, `bun run lint`, and `bun test`.
2026-04-24T11:29:14.5244425+02:00 [USER] Set the package version to today, push it, and run a new nightly release.
2026-04-24T11:31:05.0254890+02:00 [CODE] Bumped `package.json` version to `2026.4.24` so release and nightly workflows target today's build number.
2026-04-24T11:31:05.0254890+02:00 [TOOL] Verified the version-only change with `bun run typecheck`.
2026-04-24T11:54:02.2711367+02:00 [USER] Reported that installer launch on `v2026.4.22-nightly` hid the startup update flow, then a manual reopen created the old main window while `v2026.4.24` downloaded in the background.
2026-04-24T11:54:02.2711367+02:00 [CODE] Fixed single-instance startup updater handling so second launches refocus the updater window instead of creating `mainWindow`, and made the updater window show in the taskbar and take focus.
2026-04-24T11:54:02.2711367+02:00 [TOOL] Verified with `bun run typecheck` and `bunx biome check electron/main.ts electron/updater.ts`.
2026-04-24T11:57:39.7145919+02:00 [USER] Requested a new nightly using a SemVer-safe patch suffix, so bump version to `2026.4.24-1` and run the workflow again.
2026-04-24T11:58:06.2997467+02:00 [CODE] Bumped `package.json` version to `2026.4.24-1` so workflows can publish a fresh nightly tag without breaking SemVer-based packaging.
2026-04-24T11:58:06.2997467+02:00 [TOOL] Verified the release-version bump with `bun run typecheck`.
2026-04-24T12:06:40.6776724+02:00 [USER] Asked to close issue `#27`, fix the remaining open security issues with emphasis on `#40` and `#41`, then publish a `-2` nightly.
2026-04-24T12:06:40.6776724+02:00 [CODE] Removed silent SRP-to-password fallback, added Ed25519 signed-prekey generation and verification plus secure random prekey IDs, and bounded ratchet skipped-key growth to mitigate issues `#40`-`#43`.
2026-04-24T12:06:40.6776724+02:00 [TOOL] Verified with `bun run typecheck`, `bun test src/lib/tests/e2ee.integration.test.ts src/lib/tests/failure.integration.test.ts src/lib/tests/contract.api.test.ts`, and `bunx biome check` on touched auth/E2EE files.
2026-04-24T18:41:53.5412357+02:00 [USER] Requested to process all open repo issues, keep already-fixed local work, bump version to `25.04`, push to `master`, close issues, and run a nightly.
2026-04-24T18:41:53.5412357+02:00 [CODE] Kept the local security hardening for issues `#40`-`#43` and bumped `package.json` version to SemVer-safe `25.4.0` for the requested `25.04` release line.
2026-04-24T18:41:53.5412357+02:00 [TOOL] Verified `bun run typecheck` and `bun run lint`; `bun test` in this sandbox still showed known module-resolution errors (`libsodium-sumo`/`solid-js/store`) despite packages present in `node_modules`.
2026-04-28T17:10:36+02:00 [USER] Reported `bun run dev` failed because Electron dev startup passed `--no-sandbox` and Haven blocked it as dangerous.
2026-04-28T17:10:36+02:00 [CODE] Updated Vite Electron startup hooks to launch dev Electron with `["."]` instead of the plugin default `[".", "--no-sandbox"]`, keeping the app security block intact.
2026-04-28T17:10:36+02:00 [TOOL] Verified with `bunx biome check vite.config.ts electron/main.ts`, `bun run typecheck`, and escalated `bun run dev`; dev server started at `http://localhost:5173/` and Electron reached `app-ready`.
2026-04-28T17:40:01+02:00 [USER] Reported `write EIO` uncaught exception when closing Haven after opening with `bun run dev`.
2026-04-28T17:40:01+02:00 [CODE] Hardened Electron secure logger console transport so closed dev stdout/stderr streams with `EIO` or `EPIPE` cannot crash the main process; file logging remains unchanged.
2026-04-28T17:40:01+02:00 [TOOL] Verified with `bunx biome check electron/secure-logger.ts`, `bun run typecheck`, `bun run lint`, `bun test`, and a limited `bun run dev` smoke test that reached Electron main but quit on existing single-instance lock.
2026-04-28T17:59:58+02:00 [USER] Clarified that on macOS, closing Haven after `bun run dev` hides the window and leaves the Electron process alive.
2026-04-28T17:59:58+02:00 [CODE] Made dev runtime skip tray creation, allow window close, set quit state on `before-quit`, and quit on `window-all-closed` even on macOS while preserving packaged macOS close-to-tray behavior.
2026-04-28T17:59:58+02:00 [TOOL] Stopped stale old dev Electron PID `15823`, verified patched `bun run dev` exited after app quit with `dev-window-closing`, and reran `bunx biome check electron/main.ts electron/secure-logger.ts`, `bun run typecheck`, `bun run lint`, and `bun test`.
2026-04-28T18:06:18+02:00 [USER] Reported login/register always shows generic auth failure and backend logs show nothing; requested specific in-app errors and log review.
2026-04-28T18:06:18+02:00 [CODE] Added auth API request start/success/failure detailed logs without request bodies, added auth UI failure logs, and mapped network/timeout/server/conflict/validation/unexpected-response failures to specific EN/DE messages.
2026-04-28T18:06:18+02:00 [TOOL] Local app logs showed no auth API attempts, only startup/token-load events; unauthenticated curl and CORS preflight probes to `https://havenapi.becloudly.eu/api/v1/...` returned Cloudflare `403 Forbidden` with `Request forbidden by administrative rules`, explaining empty backend logs.
2026-04-28T18:06:18+02:00 [TOOL] Verified auth error/logging changes with `bunx biome check src/lib/api/client.ts src/views/Auth.tsx src/i18n/en.ts src/i18n/de.ts`, `bun run typecheck`, `bun test`, and `bun run lint`.
2026-04-28T18:54:11+02:00 [USER] Requested committing and pushing local Haven app changes, with app version set for `2026.04.28`.
2026-04-28T18:54:11+02:00 [ASSUMPTION] Used SemVer-safe package version `2026.4.28` instead of invalid `2026.04.28` because package versions cannot contain leading-zero numeric identifiers.
2026-04-28T19:11:34+02:00 [USER] Requested auditing `TODO.md` and `TODO2.md` against current client code, deleting old todo files, replacing them with one current TODO, then committing and pushing.
2026-04-28T19:11:34+02:00 [CODE] Replaced `TODO.md` with only verified unfinished client work and deleted `TODO2.md`; retained gaps for server/channel UI, E2EE product wiring, LiveKit, query usage, virtualization, offline storage/UX, and focused tests.
2026-04-28T19:11:34+02:00 [TOOL] Checked TODO evidence with `rg` plus targeted source reads; `bunx biome check TODO.md` processed no files because TODO docs are ignored by Biome config.
2026-04-28T19:18:07+02:00 [USER] Requested local-only frontend redesign into a normal 1:1 secure chat app, removing server/explorer frontend surfaces for now and not pushing.
2026-04-28T19:18:07+02:00 [CODE] Reworked `Home.tsx` into a private-chat shell with Chats/Contacts tabs, removed server/explorer sidebar surfaces, kept DM and friend-management flows accessible, and updated EN/DE labels.
2026-04-28T19:18:07+02:00 [TOOL] Verified local-only UI change with targeted Biome check, `bun run typecheck`, `bun run lint`, `bun test`, and `bun run dev`; dev showed existing Solid cleanup warning but no new build/type errors.
2026-04-28T19:29:35+02:00 [USER] Requested pushing the local secure chat UI redesign changes.
2026-04-28T19:45:59+02:00 [USER] Requested static security analysis against researchers, forensics, malware, and hackers, written as Haven CVE-style issues.
2026-04-28T19:45:59+02:00 [CODE] Added `HCVE_SECURITY_REVIEW.md` with fourteen HCVE findings covering plaintext DMs, broad secure-store IPC, local forensic exposure, detailed logs, updater signing, beta Electron, TLS pinning, WebSocket validation, token migration, and cache privacy.
2026-04-28T20:15:35+02:00 [USER] Narrowed remediation request to HCVE-2026-0001 through HCVE-2026-0004 only.
2026-04-28T20:15:35+02:00 [CODE] Wired DM sending through X3DH + Double Ratchet ciphertext payloads, bootstrapped E2EE bundles on session restore/login, decrypted incoming encrypted DMs when possible, removed generic secure-store preload access in favor of scoped auth/E2EE/cache IPC, and sanitized detailed logs before disk write.
2026-04-28T20:15:35+02:00 [TOOL] Verified client changes with `bun run typecheck`, `bun test`, and `bun run lint`; lint passed with only the existing Biome schema-version info.
2026-04-28T20:22:06+02:00 [USER] Requested pushing the client version to `2026.4.29`.
2026-04-28T20:22:06+02:00 [CODE] Bumped `package.json` version from `2026.4.28` to `2026.4.29` before pushing client master.
2026-04-29T09:08:58+0200 [USER] Reported profile picture upload succeeds server-side but client does not update/show it; provided `log.txt`.
2026-04-29T09:08:58+0200 [CODE] Added shared `ProfileAvatar` resolver component for friend/DM avatar rendering and expanded own-profile avatar change key to all supported backend avatar fields.
2026-04-29T09:08:58+0200 [TOOL] `log.txt` showed upload success, `/auth/me` success, and avatar media GET `200`, so client URL normalization/render path was the likely fault.
2026-04-29T09:34:54+0200 [USER] Requested fixes for HCVE-2026-0008 through HCVE-2026-0011 across client and backend WebSockets, auth token storage, and avatar privacy.
2026-04-29T09:34:54+0200 [CODE] Added strict client WebSocket event schemas and size caps, explicit pong heartbeat timeout reconnects, backend JSON pong replies, removed legacy `auth.enc` read/write IPC, and restricted avatar image URLs/CSP to Haven API avatar media.
2026-04-29T09:34:54+0200 [TOOL] Verified with client `bun run typecheck`, `bun run lint`, `bun test`; backend `cargo fmt --check`, `cargo check`, and `cargo test`.
2026-04-29T09:44:04+0200 [USER] Reported avatar still shows default despite backend upload/download logs showing `200`.
2026-04-29T09:44:04+0200 [CODE] Changed avatar cache to fetch trusted Haven API avatar media as image blobs, convert to data URLs, render only local data/self image sources, and ignore stale persisted source-url entries.
2026-04-29T09:44:04+0200 [TOOL] Verified with `bun run typecheck`, `bun run lint`, and `bun test`.
2026-04-29T09:50:18+0200 [USER] Requested UI settings and account menus with only already-functional app actions.
2026-04-29T09:50:18+0200 [CODE] Added titlebar account menu with current user identity and logout, plus settings menu with theme toggle, command palette, and help actions.
2026-04-29T09:50:18+0200 [TOOL] Verified with `bun run typecheck`, `bun test`, and `bun run lint`.
2026-04-29T09:56:33+0200 [USER] Reported first login attempt shows auth failure but second click logs in without changing inputs.
2026-04-29T09:56:33+0200 [CODE] Made post-login E2EE bundle bootstrap best-effort after UI session notification and passed the fresh access token to E2EE bundle upload.
2026-04-29T09:56:33+0200 [TOOL] Verified with `bun run typecheck`, `bun test`, and `bun run lint`.
2026-04-29T10:06:36+0200 [USER] Reported friend requests show stale outgoing state after switching accounts and accepting the visible request does nothing.
2026-04-29T10:06:36+0200 [CODE] Scoped friends cache by user id, reset friend state on session switch, and guarded refresh results against account-switch races.
2026-04-29T10:06:36+0200 [TOOL] Verified with `bun run typecheck`, `bun test`, and `bun run lint`.
2026-04-29T10:14:29+0200 [USER] Reported account 1 still cannot accept a real incoming request; backend logs showed accept URL with large request id returning `404`.
2026-04-29T10:14:29+0200 [CODE] Preserved friend request ids as exact strings from raw JSON text before building accept/decline URLs, and added regression tests for large request ids.
2026-04-29T10:14:29+0200 [TOOL] Verified with `bun run typecheck`, `bun test`, and `bun run lint`.
2026-04-29T10:25:01+0200 [USER] Reported opening a DM from an accepted friend showed `forbidden`; backend logs showed `/api/v1/dm/threads` returned `403`.
2026-04-29T10:25:01+0200 [CODE] Preserved exact `friend_user_id` and `peer_user_id` values, and sent DM thread creation with a raw JSON numeric id so the backend receives the true friend id.
2026-04-29T10:25:01+0200 [TOOL] Verified with `bun run typecheck`, `bun test`, and `bun run lint`.
