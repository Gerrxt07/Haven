# Haven Static Security Review

Date: 2026-04-28
Scope: local static review of the Haven desktop client.
Method: source review only. No dynamic exploit, no reverse engineering, no backend source review.

## Short Answer

Haven has a good Electron baseline. The main window uses sandboxing, context isolation, no Node integration, blocked webviews, blocked untrusted navigation, a CSP, guarded IPC sender checks, scoped preload APIs, Electron fuses, and safeStorage for local secrets.

The 1:1 direct message path now sends encrypted payloads through the backend and decrypts incoming encrypted DMs when local ratchet state is available.

Against remote web attackers, the app is fairly hardened. Against network MITM with a trusted root, local malware, update supply-chain compromise, or forensic access to the same OS user, remaining issues still exist below.

## Security Posture

| Threat | Current posture | Reason |
| --- | --- | --- |
| Drive-by web/XSS attacker | Medium to strong | Electron sandbox, context isolation, CSP, blocked navigation, no raw IPC. |
| Malicious backend/operator | Improved for DM content | Direct messages now send ciphertext through the backend path. |
| Network attacker | Medium | TLS is used, SRP verifies server proof, but no API certificate/public-key pinning. |
| Local malware in same user account | Weak | Tokens and E2EE private keys can be read through app context or runtime memory. |
| Forensic access to user profile | Medium to weak | safeStorage protects at rest, but same-user/keychain access and logs/cache remain useful. |
| Security researcher reversing package | Medium | asar, bytenode, fuses, and integrity help tamper cost, but do not provide real secrecy. |
| Update supply-chain attacker | Medium risk | GitHub updater is used; package config does not show enforced code-signing/publisher pinning. |

## Positive Findings

- `electron/main.ts` creates the main window with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`, `webSecurity: true`, and `webviewTag: false`.
- `electron/main.ts` blocks risky Chromium flags like remote debugging, `--no-sandbox`, proxy override, and certificate-ignore flags.
- `electron/main.ts` blocks `will-attach-webview`, denies new windows, and prevents untrusted navigation.
- `electron/main.ts` validates IPC sender identity for sensitive handlers.
- `scripts/apply-electron-fuses.cjs` disables RunAsNode, disables Node options, disables Node CLI inspect args, enables cookie encryption, enables asar integrity, and only loads the app from asar.
- `src/lib/auth/session.ts` uses SRP challenge/verify and verifies the server proof.
- `src/lib/realtime/manager.ts` sends WebSocket auth as a first message instead of leaking tokens in the URL.
- `src/lib/e2ee` has signed prekey checks, random one-time prekey IDs, X3DH, and Double Ratchet primitives.
- `src/lib/dm/service.ts` sends direct messages as encrypted payloads and decrypts incoming encrypted DMs when possible.
- `electron/preload.ts` exposes scoped auth, E2EE, and cache storage calls instead of one generic secure-store namespace API.
- `electron/main.ts` sanitizes detailed logs before writing them to disk.

## HCVE Issues

### HCVE-2026-0005: Auto-Update Trust Depends On GitHub Feed Without Visible Code-Signing Enforcement

Severity: High

Affected files:
- `package.json`
- `electron/updater.ts`

Evidence:
- `electron-updater` is configured with GitHub publish provider.
- Package config does not show macOS signing/notarization identity, Windows certificate/publisher settings, or publisher pinning.
- Nightly updates allow prerelease and downgrade.

Impact:
- A compromised GitHub release token, repo maintainer account, CI secret, or update metadata path can become a malware delivery path.
- Lack of visible signing enforcement weakens defense against tampered packages.

Fix:
- Enforce macOS Developer ID signing and notarization.
- Enforce Windows Authenticode signing and publisher validation.
- Protect release workflow tokens and require approvals.
- Disable downgrade outside explicit dev/nightly workflows.
- Consider TUF-style update metadata or detached signature verification.

### HCVE-2026-0006: Production Uses Beta Electron

Severity: Medium

Affected files:
- `package.json`

Evidence:
- `electron` is pinned to `42.0.0-beta.6`.

Impact:
- Beta Electron can include unstable security behavior, unfinished mitigations, and fast-changing Chromium/Electron bugs.
- Security researchers will flag beta runtime use in a desktop messenger.

Fix:
- Use the latest stable Electron release for normal builds.
- Keep beta Electron only on an explicit experiment branch.
- Track Electron security releases and rebuild quickly.

### HCVE-2026-0007: API And WebSocket Do Not Pin Backend Identity

Severity: Medium

Affected files:
- `src/lib/api/client.ts`
- `src/lib/e2ee/api.ts`
- `src/lib/realtime/manager.ts`
- `electron/main.ts`

Evidence:
- API base URL is `https://havenapi.becloudly.eu/api/v1`.
- WebSocket URL resolves to `wss://havenapi.becloudly.eu/api/v1/ws`.
- No certificate/SPKI pinning or signed response layer is visible.

Impact:
- Enterprise TLS interception, hostile trusted roots, compromised CA, or local malware proxy can inspect or modify traffic.
- SRP helps password login and DM bodies are encrypted, but update metadata and non-DM API metadata remain exposed to trusted-root MITM scenarios.

Fix:
- Add SPKI pinning in the main process for production API origins.
- Pin more than one key for rotation.
- Sign critical backend responses where pinning is not practical.

### HCVE-2026-0008: WebSocket Event Validation Is Too Generic

Severity: Medium

Affected files:
- `src/lib/realtime/manager.ts`
- `src/lib/dm/service.ts`
- `src/lib/chat/service.ts`

Evidence:
- `isPresenceEvent()` accepts any object with `event_type`, `ts`, and object `payload`.
- Typed handlers then parse payload fields loosely.
- DM and channel services accept missing or fallback IDs in several paths.

Impact:
- A compromised backend or malformed WebSocket event can poison local state, create confusing messages, force bad UI states, or trigger cache writes.
- The current Solid rendering lowers XSS risk, but state confusion and denial of service remain.

Fix:
- Add strict schemas per event type.
- Enforce message size limits in the renderer too.
- Drop unknown event types by default.
- Never create fallback IDs from `Date.now()` for backend-originated events.

### HCVE-2026-0009: WebSocket Heartbeat Does Not Detect Dead Connections Strongly

Severity: Medium

Affected files:
- `src/lib/realtime/manager.ts`

Evidence:
- Client sends `{ type: "ping" }` every 25 seconds.
- A separate timer calls `markHeartbeat()` locally every 10 seconds.
- There is no observed server pong timeout that closes a stale socket.

Impact:
- Dead or half-open connections can look alive.
- Users may miss messages/presence until another network event closes the socket.

Fix:
- Require server pong/ack.
- Track last server heartbeat.
- Close and reconnect when server heartbeat exceeds a strict timeout.

### HCVE-2026-0010: Legacy Token Store Creates Extra Token Copy

Severity: Medium

Affected files:
- `electron/main.ts`
- `src/lib/auth/session.ts`

Evidence:
- `persistTokens()` writes the access token through both `storeToken()` and `secureStoreSet("auth", "token.access")`.
- `bootstrapFromStorage()` migrates from legacy token.
- Main-process `onBeforeSendHeaders` still falls back to `auth.enc`.

Impact:
- More copies mean more forensic recovery surface.
- The main process can inject a stale legacy token if cache/state drift occurs.

Fix:
- Finish migration.
- Delete `auth.enc` support after one version window.
- Make header injection read only the canonical auth state.

### HCVE-2026-0011: Profile Image Cache Allows Arbitrary HTTPS Image Origins

Severity: Medium

Affected files:
- `src/lib/cache/profile-images.ts`
- `electron/main.ts`

Evidence:
- `normalizeAvatarUrl()` accepts `https?:`, `data:`, and `blob:` avatar URLs.
- CSP allows `img-src 'self' data: https:`.
- Avatar source URLs are persisted in secure-store or localStorage fallback.

Impact:
- Remote avatar URLs can leak user IP, user-agent, timing, and social graph access patterns to third-party image hosts.
- A malicious backend or profile field can make clients request attacker-controlled HTTPS images.

Fix:
- Proxy avatars through the Haven API.
- Restrict image origins to the API/CDN allowlist.
- Avoid persisting arbitrary third-party URLs.

### HCVE-2026-0012: Dev CSP Is Unsafe If Dev Build Is Used For Real Accounts

Severity: Low

Affected files:
- `electron/main.ts`

Evidence:
- Dev CSP includes `script-src 'self' 'unsafe-eval'`.
- Dev CSP includes `style-src 'self' 'unsafe-inline'`.
- Dev connect-src allows localhost WebSockets.

Impact:
- This is acceptable for local development.
- It is risky if testers use real accounts in dev builds or if dev runtime is accidentally packaged.

Fix:
- Add a visible dev-account warning.
- Assert packaged builds never use `VITE_DEV_SERVER_URL`.
- Prefer test accounts for `bun run dev`.

### HCVE-2026-0013: Offline Caches Leak Social Metadata Under Same-User Access

Severity: Low

Affected files:
- `src/lib/cache/offline-metadata.ts`
- `src/lib/friends/store.ts`
- `src/lib/cache/profile-images.ts`

Evidence:
- Offline metadata stores channel/message IDs, author IDs, encryption flag, and timestamps.
- Friends cache stores social graph data.
- Profile image cache stores avatar source/data.
- These are protected by secure-store where available, but not against same-user malware or app-context compromise.

Impact:
- Even without plaintext message bodies, forensics can reveal who talked to whom and when.

Fix:
- Add cache retention limits.
- Add local privacy wipe.
- Store less metadata where possible.
- Keep all cache fallback paths out of localStorage in desktop builds.

## Recommended Fix Order

1. Harden updater signing and release workflow in HCVE-2026-0005.
2. Move from beta Electron to stable in HCVE-2026-0006.
3. Add backend identity pinning or signed critical responses for HCVE-2026-0007.
4. Tighten WebSocket schemas and heartbeat behavior.
5. Clean token migration and cache privacy.

## Suggested Definition Of Secure Enough For Public Claim

Haven should not claim broader production-grade secure-messenger hardening until all of this is true:

- Signed/notarized packages and update verification are enforced.
- Stable Electron is used for production releases.
- API/backend identity protection is stronger than default OS CA trust.
- Realtime event schemas and heartbeat liveness are strict.
