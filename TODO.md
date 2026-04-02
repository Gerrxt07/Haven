# 🚀 Haven - Project Roadmap & Implementation Notes

Diese Datei dient als zentrales TODO- und Notiz-Dokument für die Entwicklung. Die Reihenfolge richtet sich nach einer **realistischen Implementierungs-Priorität**. 

---

## 💡 Architektur- und Stack-Optimierungen (WICHTIG!)
Da als Basis **SolidJS** statt React genutzt werden soll (was für die Performance eine exzellente Wahl ist!), gibt es ein paar Framework-spezifische Anpassungen:

*   **Framer Motion ➡️ `solid-motionone` / `@joshcena/solid-motion`:** Framer Motion ist stark an React gebunden. Motion One liefert unter SolidJS eine native, extrem performante Alternative (hardware-beschleunigt via WAAPI).
*   **Virtualisierung ➡️ `@tanstack/solid-virtual`:** `@tanstack/react-virtual` läuft nur unter React, TanStack bietet aber zum Glück offizielle Solid-Adapter an. Alternativ: `solid-virtual-scroll`.
*   **State Management ➡️ Solid Stores (Built-in) statt Zustand:** Zustand ist eher für React gedacht. SolidJS hat mit `createStore` ein extrem mächtiges und reaktives State-Management mitgeliefert (perfekt für globale Daten wie Server-Listen & User-Status). Für server-state (z.B. Chat-Verläufe cachen) bleibt **TanStack Query** (`@tanstack/solid-query`) die beste Wahl!
*   **UI Components ➡️ `shadcn-solid` & `kobalte`:** Die klassischen shadcn/ui Komponenten sind React-basiert, es gibt aber einen exzellenten Community-Port für Solid (`shadcn-solid`). Als "Unstyled UI" (für maximale Tailwind-Kontrolle ohne Ballast) sollte **Kobalte** (vergleichbar mit Radix für React) die Basis bilden.
*   **Backend Architektur ➡️ Event-Bus statt REST:** Die App ist ein Echtzeit-System (Discord-Klon). Nutze WebSockets über Axum, um Events (neue Nachrichten, Online-Status/"Presence") an Clients zu pushen. **DragonflyDB** dient als rasanter State-Speicher dafür.
*   **Datenbank & IDs ➡️ Snowflake-IDs & Cursor-Pagination:** Nutze **niemals** simples Auto-Increment und **niemals** `OFFSET`-Pagination, da beides bei Skalierung kollabiert. Nutze **Snowflake-IDs** (wie Discord/Twitter) für sortierbare IDs über verteilte Systeme hinweg und setze konsequent auf **Cursor-based Pagination** für den Chat-Verlauf.
*   **Auto-Updater (Discord-Style):** Um Updates schneller zu machen und den "Pre-Start Update UI" Effekt zu erzielen, nutze `electron-updater`, präsentiere aber beim Start ein leichtgewichtiges Browser-Fenster (~400x400px, frameless). Nutze **NSIS Delta-Updates** (nur die geänderten Bytes herunterladen, nicht die ganze .exe), das beschleunigt Upgrades enorm.

---

## 📋 Implementierungs-Priorität (Roadmap)

### 📌 Priorität 1: Basis-Infrastruktur & Umgebung (The "Boring" Stuff)
*Das Fundament muss felsenfest und performant sein, bevor schöne UI gebaut wird.*

- [ ] **Backend-Setup (Rust + Axum)**
  - Grundlegendes Boilerplate-Setup, Routen-Architektur.
  - Integration von **PostgreSQL** für relationale Daten (User, Channels).
  - Integration von **DragonflyDB** (In-Memory Datastore als weitaus schnellere Alternative zu Redis - exzellent für Session-Management).
  - Optional: **TimescaleDB** für Analytics oder zeitskritisches Logging.
- [ ] **Desktop-Client & Auto-Updater Layer (Electron + Bun)**
  - [x] Implementierung eines separaten, kleinen Splash/Updater-Windows (Framerless).
  - [x] Integration von `electron-updater` inkl. **NSIS Delta-Updates** für blitzschnelle Patches.
  - [x] Github Release Hook Konfiguration konfigurieren.
- [ ] **Kryptografie-Grundbausteine implementieren**
  - Setup von **XChaCha20-Poly1305** (performantestes AEAD für generelle Datenbank/Datei-Verschlüsselung).
  - Sicheres Hashing mit **Argon2** und Nutzung von **PASETO statt JWT** (sicherer gegen Implementierungsfehler). Inkl. Pepper/Salt Verwaltung.

### 📌 Priorität 2: Core Data-Layer & Kommunikation (The "Engine")
*Die APIs und Pipelines, die Frontend und Backend performant verbinden.*

- [ ] **gRPC / WebSockets Architektur**
  - Etablierung bidirektionaler Streams zwischen Client (Electron Main Process/Renderer) und Rust-Backend.
  - Wahl treffen: gRPC-Web (perfekt für typisieres Contract-Design) vs. native WebSockets.
- [ ] **End-to-End Encryption (E2EE) für Messages**
  - Implementierung (oder Fork einer Lib) des **Double Ratchet Protokolls** (Forward & Backward Secrecy).
  - Aufbau des Key-Exchange (X3DH) für asynchrone sichere Kommunikation.
- [ ] **Video / Voice (SFU Infrastruktur)**
  - Setup von **LiveKit** (deutlich bessere Developer-Expirience, Skalierung und Out-Of-The-Box-Features im Vergleich zum rohen Aufbau eines WebRTC-rs Servers).
  - Client-seitige LiveKit-SDK Integration in die SolidJS App.

### 📌 Priorität 3: Frontend Foundation & State (The "Skeleton")
*Auffrischen des Vite/Solid-Setups.*

- [ ] **Migrations-/Setup-Phase: SolidJS**
  - Tailwind CSS & `shadcn-solid` konfigurieren.
  - Setup von `@tanstack/solid-query` für robustes Data-Fetching/Caching.
  - Setup der globalen Stores für lokale Client-States (`createStore` von Solid).
  - Typisierung (TypeScript) konsequent für alle IPC (Inter-Process-Communication) Brücken zwischen Electron (Main) und SolidJS (Renderer) anlegen.

### 📌 Priorität 4: UX & UI Design (The "Flesh")
*Die Optik und Interaktion der Applikation.*

- [ ] **Bento-Grid Layout**
  - Erstellen des App-Dashboards in modernen Bento-Grid Kacheln (nutze CSS Grid / Flexbox + Tailwind für responsive Anpassung).
- [ ] **Glassmorphism-Styling**
  - Einbau von `backdrop-blur-*`, semi-transparenten Hintergrundfarben (`bg-white/10`) und feinen Borders (`border-white/20`).
  - *Notiz zur Performance:* Übermäßiger Gebrauch von `backdrop-filter` kann auf schwächeren Systemen ruckeln. Performance hier regelmäßig in Electron checken!
- [ ] **Animationen**
  - Einbau von `solid-motionone` für weiche Kachel-Übergänge (Page Transitions) und Hover-Effekte.
- [ ] **Listen-Virtualisierung (Performance für große Chats)**
  - Implementierung von `@tanstack/solid-virtual` für Chat-Historien und User-Listen (DOM entlasten).

### 📌 Priorität 5: Polish & Edge-Cases
- [ ] Offline-First Funktionalität via lokalem Caching im Electron-Main Process (ggf. Bun.sqlite als lokalen Store + XChaCha20 Verschlüsselung der lokalen SQLite DB).
- [ ] Security-Härtung (Electron ContextBridge absichern, CSP anpassen).
- [ ] Fallbacks für Verbindungsabbrüche in LiveKit / gRPC.
