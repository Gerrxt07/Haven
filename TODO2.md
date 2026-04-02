# TODO2 – Frontend↔Backend Integrations (ohne UI)

Ziel: Übersicht, was im Client noch gebaut werden muss, damit vorhandene Backend-Funktionen produktiv genutzt werden.

## 1) API Foundation (Renderer)
- [x] Zentrale API-Client-Schicht erstellen (`src/lib/api/`), inkl. `baseUrl`, Timeouts, Retry-Policy für idempotente GETs.
- [x] Einheitliche Fehler-Mapping-Logik für Backend-Fehler (`error`, HTTP-Status, Validation).
- [x] Typisierte Request/Response-Modelle für Auth, Chat, E2EE, Presence.
- [x] Request-Abbruch (`AbortController`) für Wechsel von Server/Channel.

## 2) Auth-Integration
- [x] Login/Register/Refresh/Me als echte API-Calls anbinden.
- [x] Token-Lifecycle im Client implementieren (Access-Expiry erkennen, Refresh-Flow, Logout-Invalidierung).
- [x] IPC ergänzen: Token **lesen** und **löschen** (aktuell existiert nur `storeToken` in preload).
- [x] Optionalen 401-Interceptor einbauen (einmaliger Refresh, dann Retry).

## 3) Realtime Integration (`/ws` / `/realtime/ws`)
- [x] WebSocket-Manager implementieren (connect/reconnect/backoff/jitter).
- [x] Event-Router für Presence, `new_message`, Join/Broadcast.
- [x] Heartbeat/Ping-Pong und Verbindungszustand als globaler Store.
- [x] Subscription-Handling pro Channel/Server (beim Wechsel sauber unsubscriben).

## 4) Core Chat API Nutzung
- [x] Endpoints anbinden:
  - `POST /servers`
  - `POST /channels`
  - `POST /messages`
  - `GET /channels/:id/messages?before=<cursor>&limit=<n>` (cursor-only)
- [x] Cursor-Pagination im Client-State (`before` aus ältester Nachricht der Seite).
- [x] Dedupe von Nachrichten (REST + WS Race Conditions).
- [x] Optimistic Writes + serverseitiges Reconcile (Snowflake-ID Reihenfolge).

## 5) E2EE Client-Seite (kritisch)
- [x] Krypto-Stack im Client auswählen und integrieren (z. B. libsodium oder sauberer Typed-Stack mit X25519 + AEAD).
- [x] Key-Bundle-Flow implementieren:
  - Upload: `POST /e2ee/keys/bundle`
  - Fetch Bundle: `GET /e2ee/keys/bundle/:user_id`
  - Claim Prekey: `POST /e2ee/keys/claim`
- [x] Per-Message-Key-Wrapping für Empfänger bauen (`recipient_key_boxes`).
- [x] Nachrichtenversand E2EE-fähig machen (`ciphertext`, `nonce`, `aad`, `algorithm`).
- [x] Empfangsseite: Entschlüsselung lokaler Payloads + Fehlerpfad bei fehlendem Key-Material.
- [x] Ratchet-State lokal persistieren (pro Conversation), versionieren und migrierbar halten.

## 6) Electron Bridge / sichere lokale Speicherung
- [x] Preload/API erweitern für sichere E2EE-Key-Verwaltung (store/load/delete), analog Token-Handling.
- [x] Trennung: Token-Storage und E2EE-Key-Storage mit klaren Namespaces.
- [x] Optional: Verschlüsselte lokale Cache-Schicht für offline-fähige Message-Metadaten.

## 7) Frontend-Architektur (ohne UI)
- [x] `@tanstack/solid-query` einführen für Server-State (Auth/User/Channels/Messages).
- [x] Solid Global Stores für Session, WS-State, Presence, aktive Channel-Kontexte.
- [x] Stabile Domain-Typen für IPC- und HTTP-Grenzen (keine `any`-Pfade).

## 8) Security/Robustness im Client
- [x] Input-/Output-Validierung an API-Grenzen (Runtime-Validation).
- [x] Redaction für sensible Felder in Logs (`token`, `ciphertext`, key material).
- [x] Safe Retry-Regeln für Write-Endpoints (idempotency-sicher planen).
- [x] Session Recovery nach App-Neustart (ohne Secrets im Renderer zu leaken).

## 9) Tests (Integration, nicht UI)
- [x] Contract-Tests gegen Backend-Responses (Auth/Chat/E2EE).
- [x] WS-Integrationstests (Reconnect, Event-Reihenfolge, Duplicate-Handling).
- [x] E2EE-Ende-zu-Ende Tests (Bundle claim -> encrypted send -> decrypt receive).
- [x] Failure-Tests (abgelaufene Tokens, ungültige Prekeys, fehlende Recipient-Keys).

## Hinweise aus aktuellem Code-Stand
- Backend-Funktionen sind bereits breit vorhanden (Auth, Chat, WS, E2EE-Key-API).
- Client hat jetzt eine E2EE-Datenpipeline (X3DH, Double Ratchet, sichere Persistenz), aber Auth/Realtime/Chat-Integrationsschicht ist noch nicht vollständig im App-Flow verdrahtet.
- Für TODO1-Punkt „E2EE“ ist der Kern-Stack umgesetzt; offen sind vor allem Integrations-/Testtiefe im Produktfluss.
