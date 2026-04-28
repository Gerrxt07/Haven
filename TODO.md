# TODO

Verified against the current client code on 2026-04-28. Old `TODO.md` and
`TODO2.md` were audited and collapsed into this file. Completed items were
removed. Items below are not fully completed in the app code yet.

## Product Flow

- [ ] Build the public server explorer.
  - `Home.tsx` has an Explorer sidebar entry, but the main Explorer screen is a
    placeholder.
  - No bento-grid open-server listing is wired to real server data.

- [ ] Wire server/channel chat into the visible app flow.
  - `src/lib/api/chat.ts` and `src/lib/chat/service.ts` exist.
  - `Home.tsx` still has a server-list placeholder and no channel list,
    channel message panel, or channel composer.

- [ ] Add voice/video calling.
  - No LiveKit dependency or LiveKit client integration exists.
  - Electron has media permission plumbing only.
  - Add connection-loss fallback behavior once voice/video exists.

## Frontend Data And Performance

- [ ] Use `@tanstack/solid-query` for real server-state flows.
  - `QueryClientProvider` is configured.
  - Current data loading is still mostly direct service/store calls.

- [ ] Add list virtualization for large message/friend/server lists.
  - `@tanstack/solid-virtual` is installed.
  - No `createVirtualizer` usage exists in the code.
  - Chat and DM lists still render with plain `For` loops.

- [ ] Add message-height premeasurement for virtualized chat.
  - `@chenglou/pretext` is installed.
  - It is not used to precompute chat row heights.

- [ ] Track access-token expiry proactively.
  - Refresh-on-401 exists.
  - Token `expires_in_seconds` is not persisted as an expiry timestamp or used
    to refresh before requests fail.

## Offline And Cache

- [ ] Expand offline-first storage beyond metadata.
  - Current channel cache stores encrypted message metadata only.
  - Message content, full thread state, send queues, and conflict handling are
    not persisted for offline use.
  - No local SQLite/Bun.sqlite store exists.

- [ ] Add offline recovery UX.
  - Existing services can hydrate some cached metadata.
  - The UI does not clearly expose offline state, retry queues, or stale data.

## UX Polish

- [ ] Complete app-wide motion polish.
  - `solid-motionone` is used in auth and command palette areas.
  - Main chat, server explorer, and list transitions are not fully animated.

- [ ] Complete app-wide glassmorphism/performance pass.
  - Some `backdrop-blur` styling exists.
  - The main app surfaces are not consistently reviewed for the intended style
    or for Electron performance impact.

## Security And Robustness

- [ ] Add focused tests for auth diagnostics logging.
  - Auth API/UI diagnostics were added.
  - No dedicated tests assert safe auth-log shape or that secrets stay out of
    auth diagnostic logs.

- [ ] Add product-flow tests for encrypted messaging.
  - Crypto and DM transport integration tests exist.
  - No UI-level test proves a decrypted DM is displayed in the actual app flow.
  - Channel message encryption still needs a product-flow test when channel UI
    returns.
