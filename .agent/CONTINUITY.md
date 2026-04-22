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

