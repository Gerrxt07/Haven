# 🏁 The Haven "Hack-The-App" Challenge

Welcome, Hacker! Haven is an Electron-based Discord alternative designed with security first. I am building this project as a solo developer and use many techniques to harden the app.

Standard Electron apps are usually easy to unpack and manipulate. **I challenge you to prove me wrong.**

**Can you break it?**

## 🏆 The Goal
There are no artificial hidden flags. Your goal is to break Haven's local security model in a real-world scenario. 

**Suggested Scenarios:**
1. **The Data Heist:** Create a free account in the app, log in, and try to extract your raw authentication tokens, decrypted database files, or other sensitive data from disk/memory without using the official UI.
2. **The Sandbox Escape:** Find a way to bypass the Electron sandbox and execute arbitrary code on the host system (RCE).
3. **The IPC Manipulator:** Intercept and modify the internal IPC communication to force the application into an unauthorized state.

**Your mission:** Find a critical flaw, extract sensitive local data, or achieve code execution, and provide a detailed write-up of how you bypassed the app's defenses.

## 🎯 Scope

**✅ IN SCOPE (Local Client):**
* Reverse engineering the compiled Haven binaries (without using the real source code from the repository).
* Extracting/Decompiling ASAR or V8 Bytecode (`bytenode`).
* Bypassing local security measures (DevTools, Fuses, Sandbox).
* Inspecting and manipulating local IPC traffic.

**❌ OUT OF SCOPE (Network/Infrastructure):**
* Any attacks against `havenapi.becloudly.eu` or the backend infrastructure.
* DoS/DDoS attacks.
* Social Engineering against users or me.

## 📜 Rules
1. **Keep it Local & Respect Privacy:** Focus your tools and scripts purely on your own local installation and your own account. Do not attempt to access real user data and do not spam the API.
2. **How to Report (Responsible Disclosure):**
   * 🚨 **Critical & Actively Harmful Vulnerabilities** (e.g., severe RCE, backend exploits, anything affecting other users): Please report these **privately via email** as outlined in the [SECURITY.md](./SECURITY.md).
   * 📝 **Challenge Write-ups & Non-Critical Findings** (e.g., local token extraction, bypass documentation, regular bugs): Feel free to open a regular **GitHub Issue** or submit a **GitHub Security Advisory** directly in the repository.
3. **No Infrastructure Damage:** Keep your tools focused on the local client.
4. **Share the Knowledge:** If you managed to break the local encryption or bypass protections (and it is not a critical zero-day), write it up! I love reading technical deep-dives.

## 🎁 Rewards
* **Hall of Fame:** If you are the first to successfully document a critical bypass or extract protected local secrets, you will be permanently featured in the official "Security Hall of Fame" on GitHub.
* **Kudos:** Massive respect from me and the community.

*Ready to start? Download the latest release and happy hunting!*