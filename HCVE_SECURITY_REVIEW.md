# Haven Static Security Review

Date: 2026-04-28
Scope: local static review of the Haven desktop client.
Method: source review only. No dynamic exploit, no reverse engineering, no backend source review.

## Short Answer

Haven has a good Electron baseline. The main window uses sandboxing, context isolation, no Node integration, blocked webviews, blocked untrusted navigation, a CSP, guarded IPC sender checks, Electron fuses, and safeStorage for local secrets.

But Haven is not yet secure enough to market as a Signal-like end-to-end encrypted chat. The current 1:1 direct message flow still sends plaintext by default. E2EE code exists, but the product path does not use it for DMs yet.

Against remote web attackers, the app is fairly hardened. Against a malicious backend, network MITM with trusted root, local malware, or forensic access to the same OS user, the current app is weaker.

## Security Posture

| Threat | Current posture | Reason |
| --- | --- | --- |
| Drive-by web/XSS attacker | Medium to strong | Electron sandbox, context isolation, CSP, blocked navigation, no raw IPC. |
| Malicious backend/operator | Weak for chat privacy | DM messages are plaintext unless E2EE path is wired in. |
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

## HCVE Issues

### HCVE-2026-0001: Direct Messages Send Plaintext By Default

Severity: Critical
Status: Fixed locally in client and backend.

Affected files:
- `src/lib/dm/service.ts`
- `src/views/DirectMessagesPanel.tsx`
- `src/lib/e2ee/client.ts`

Evidence:
- `dmService.sendMessage()` builds an optimistic message with `is_encrypted: false`.
- It calls `apiCreateDmMessage(threadId, { content: trimmed })`.
- `DirectMessagesPanel` shows a placeholder when `message.is_encrypted` is true instead of decrypting it.
- E2EE helpers like `bootstrapOwnBundle()`, `encryptAndSendMessage()`, and `decryptIncomingMessage()` exist, but are not wired into the DM UI/service path.

Impact:
- Backend operators, backend compromise, database access, logs, and legal discovery can see message content.
- A researcher can prove the app is not currently Signal-like E2EE by tracing the DM send path.

Fix:
- Client now bootstraps/uploads the user's E2EE bundle after session restore/login.
- Client DM send now uses X3DH + Double Ratchet and sends only ciphertext, nonce, AAD envelope, and algorithm.
- The first encrypted DM carries session setup metadata in the encrypted-message transport envelope.
- Incoming encrypted DMs are decrypted before rendering when the local ratchet state allows it.
- Backend DM creation now rejects plaintext DMs and stores direct messages as encrypted only.

### HCVE-2026-0002: Broad Renderer Secure-Store API Exposes All Secret Namespaces After Renderer Compromise

Severity: High
Status: Fixed locally in client.

Affected files:
- `electron/preload.ts`
- `electron/main.ts`
- `src/lib/auth/session.ts`
- `src/lib/e2ee/storage.ts`

Evidence:
- The preload exposes generic `secureStoreSet(namespace, key, value)`, `secureStoreGet(namespace, key)`, and `secureStoreDelete(namespace, key)`.
- The main process validates sender and key shape, but not capability scope.
- Any code execution in the trusted renderer can request `auth`, `e2ee`, `offline-cache`, `profile-image-cache`, and `friends-cache` namespaces.

Impact:
- XSS or malicious dependency execution in the renderer can read tokens, private E2EE material, ratchet state, cache keys, and social graph cache.
- Context isolation helps against direct Node access, but the bridge is still too powerful.

Fix:
- Removed the generic `secureStoreSet/Get/Delete(namespace, key)` preload API.
- Added scoped auth-token, E2EE, and cache IPC methods.
- Cache IPC is allowlisted to known cache namespaces.
- E2EE storage is pinned to the `e2ee` namespace.
- Auth token storage is pinned to the `auth` namespace and no longer uses the legacy generic bridge.

### HCVE-2026-0003: Local Malware Or Same-User Forensics Can Extract Tokens And E2EE Keys

Severity: High
Status: Partly mitigated locally. Same-user malware remains a hard platform limit.

Affected files:
- `electron/main.ts`
- `src/lib/auth/session.ts`
- `src/lib/e2ee/storage.ts`

Evidence:
- Tokens are stored with Electron `safeStorage`.
- E2EE identities, signed prekeys, one-time prekeys, conversation secrets, and ratchet state are stored through the same secure-store layer.
- `cachedAuthToken` keeps the access token in main-process memory.

Impact:
- `safeStorage` protects against simple disk theft, not against malware running as the same OS user.
- Memory capture, app-context script execution, keychain access, or renderer compromise can expose secrets.
- Forensic recovery can still learn social graph and maybe recover active secrets depending on machine state.

Fix:
- Removed the legacy `auth.enc` write path for new logins.
- Auth token writes now use a scoped auth IPC route instead of generic secure-store IPC.
- Detailed logs now redact sensitive fields before disk write.
- Remaining residual risk: malware running as the same OS user can still attack runtime memory or the app's own authorized IPC surface. Fully fixing this needs an app passphrase, hardware-backed key policy, or OS-level isolation work.

### HCVE-2026-0004: Detailed Log IPC Can Persist Sensitive Data

Severity: High
Status: Fixed locally in client.

Affected files:
- `electron/main.ts`
- `src/lib/logging/detailed.ts`
- `electron/secure-logger.ts`

Evidence:
- `write-detailed-log` accepts renderer-provided `data`.
- `serializeDetailedLogLine()` writes the payload directly to `detailed.log`.
- `writeDetailedErrorLog()` serializes error message and stack.
- The secure logger sanitizes normal logger output, but detailed logs do not use the same deep sanitizer in main.

Impact:
- A bug, compromised renderer, or unsafe future call can write tokens, keys, message text, email, stack traces, URLs, or profile metadata to disk.
- Logs are high-value forensic artifacts.

Fix:
- Detailed-log payloads are now sanitized in the main process before writing to disk.
- Sensitive keys such as token, authorization, private key, ciphertext, nonce, AAD, and stack are redacted.
- Log strings and total log line size are capped.
- Renderer-side detailed error logging no longer serializes stack traces.
- Detailed-log level, scope, and event are validated.

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
- SRP helps password login, but plaintext DMs and update metadata remain exposed to trusted-root MITM scenarios.

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

### HCVE-2026-0014: README Overstates Security Relative To Product Wiring

Severity: Low

Affected files:
- `README.md`
- `TODO.md`

Evidence:
- README says "End-to-end encryption key-bundle workflows".
- TODO still lists E2EE product wiring as unfinished.
- DM UI now presents itself as a private person-to-person chat.

Impact:
- Security researchers may treat the claim as misleading because the DM path is plaintext today.

Fix:
- Change docs to say "E2EE primitives are implemented, product wiring is pending".
- Do not imply message-content E2EE until HCVE-2026-0001 is fixed.

## Recommended Fix Order

1. Fix HCVE-2026-0001 first. Plaintext DMs are the biggest product-security gap.
2. Reduce renderer secret access in HCVE-2026-0002.
3. Sanitize or remove detailed logs from HCVE-2026-0004.
4. Harden updater signing and release workflow in HCVE-2026-0005.
5. Move from beta Electron to stable in HCVE-2026-0006.
6. Tighten WebSocket schemas and heartbeat behavior.
7. Clean token migration and cache privacy.

## Suggested Definition Of Secure Enough For Public Claim

Haven should not claim Signal-like privacy until all of this is true:

- New DMs are encrypted client-side by default.
- Plaintext send path is removed or explicitly marked non-secure.
- Incoming encrypted DMs decrypt in the client.
- Renderer cannot read all token/E2EE namespaces through generic secure-store IPC.
- Detailed logs cannot persist message text, tokens, private keys, or stack traces with secrets.
- Signed/notarized packages and update verification are enforced.
- Stable Electron is used for production releases.
