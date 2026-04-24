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

