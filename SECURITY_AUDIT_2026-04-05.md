# Haven Security Audit Report (2026-04-05)

## Scope
- Electron main/preload process hardening review.
- Renderer authentication/token handling review.
- Dependency vulnerability scan (`npm audit` for prod and full tree).
- Static grep for risky APIs (`eval`, `innerHTML`, process/shell boundaries).

## Executed Checks
- `npm install --package-lock-only --ignore-scripts`
- `npm audit --omit=dev`
- `npm audit`
- `bun run lint`
- `bun run typecheck`
- `rg -n "(eval\\(|innerHTML|dangerouslySetInnerHTML|shell\\.openExternal|nodeIntegration|contextIsolation|webSecurity|ipcRenderer\\.on\\(|child_process|exec\\(|spawn\\()" src electron index.ts`

## Findings

### 1) Dependency vulnerability in UI dependency chain (High)
- `npm audit` reports a high-severity ReDoS issue in `valibot` (GHSA-vqpr-j7v3-hqw9), introduced via `shadcn-solid`.
- Production-only audit (`--omit=dev`) was clean.
- Current auto-fix requires downgrading `shadcn-solid` to `0.7.5` (breaking change), so this should be validated and planned.

### 2) File persistence hardening gap for encrypted local secrets
- Token/secure-store writes did not enforce strict file mode or atomic replacement behavior.
- This could increase local exposure risk on some systems during interrupted writes or permissive defaults.

### 3) IPC payload hardening gap
- Secret storage IPC accepted arbitrarily large string payloads.
- Very large payloads can be abused for renderer-to-main memory pressure.

### 4) URL sanitization and permission request tightening opportunities
- External URL check allowed URLs with embedded userinfo (`username:password@host`), which is often used for phishing obfuscation.
- Permission request handler was not verifying `requestingOrigin` consistently.

### 5) Event listener lifecycle in preload
- Preload callback hooks did not provide unsubscribe behavior and lacked type guards for payload shape.
- This is primarily robustness, but also reduces event-surface abuse and accidental listener accumulation.

## Fixes Implemented in This Audit
- Added atomic encrypted writes with restrictive permissions (`0600`) for auth and secure-store files.
- Added max secret size guard (`8192` chars) for token and secure-store values.
- Rejected external URLs containing credential userinfo before showing open confirmation.
- Explicitly blocked `will-attach-webview` as defense in depth.
- Tightened permission request checks to require trusted `requestingOrigin`.
- Added payload validation + unsubscribe return functions for preload event listeners.

## Recommended Follow-ups
- Upgrade/patch `shadcn-solid`/`valibot` chain once compatible fix is available and rerun audits.
- Add CI SAST (Semgrep/CodeQL JS query pack) plus secret scan (gitleaks/trufflehog).
- Add signed file integrity checks for downloaded media/attachments before opening.
- Add automated Electron security regression tests around IPC, navigation, and permissions.
