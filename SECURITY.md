# Security Policy

## Safe Harbor Clause

I consider security research and vulnerability disclosure activities conducted in good faith and in accordance with this policy to be authorized conduct. I value the efforts of security researchers to improve my application and will not initiate legal action or law enforcement investigations against you for participating in this program. 

I ask only that you do not intentionally degrade the services or maliciously exploit user data beyond what is required to prove a vulnerability exists.

## Supported Versions

To ensure that your communication remains secure, I only provide active security updates and patches for the stable release versions of Haven. Because my versioning strictly follows a daily release format based on the date of compilation, all stable releases are fully supported.

| Version     | Supported          | Description |
| ----------- | ------------------ | ----------- |
| Release     | ✅ Supported       | All stable releases (formatted as YYYY.MM.DD, e.g., 2026.03.30) receive full security support. |
| Nightly     | ❌ Unsupported      | Intended for development only; may contain vulnerable or untested code. Often tagged with -nightly. |

I strongly recommend that all users enable automatic updates or routinely check for the latest stable release to ensure they are protected by the most recent security improvements, regardless of their current release date stamp.

## Scope

To help researchers focus their efforts and avoid spam, I maintain explicit definitions of what constitutes a valid, in-scope security concern for Haven.

### In-Scope Vulnerabilities
* **Remote Code Execution (RCE):** Escaping the Electron sandbox to execute arbitrary OS commands.
* **Cross-Site Scripting (XSS):** Injecting malicious scripts into the chat UI or rich text embeds that affect other users.
* **Privilege Escalation:** Gaining unauthorized privileges or bypassing internal authorization checks.
* **Data Exfiltration:** Improperly accessing local databases, session keys, or unencrypted IPC bridges.
* **Network Exploits:** Intercepting internal WebRTC negotiations, WebSocket handshakes, or bypassing CSP rules.

### Out-of-Scope Vulnerabilities
The following are typically considered out of scope and do not qualify for acknowledgement unless they lead to a chained attack:
* **Physical Access:** Attacks requiring physical access to an unlocked device or an unlocked filesystem.
* **Social Engineering:** Phishing, spear-phishing, or tricking a user into downloading malicious software.
* **Denial of Service (DoS):** Volumetric attacks requiring massive external resources to overwhelm network stacks.
* **Third-Party Noise:** Vulnerabilities found in heavily scoped third-party dependencies (like Vite dev-plugins) that cannot actually be exploited in the bundled production runtime or are not my fault. In this case, please report the issue to the original maintainers and inform me, and I will work with them to ensure it gets patched in a timely manner.
* **UI/UX Bugs:** Non-security impacting glitches (like CSS breaking or UI overlap). For this type of issue, please open a normal GitHub issue or pull request instead of a security report.

## Reporting a Vulnerability

I take the security of the Haven platform and its users extremely seriously. I recognize the importance of the security community in helping me maintain an impenetrable application. 

If you believe you have discovered an in-scope security vulnerability—whether within the Electron runtime, the SolidJS frontend, or the IPC bridging mechanisms—I would greatly appreciate your help in disclosing it to me in a responsible and confidential manner.

### How to Report

Please report any identified security vulnerabilities through one of the following secure channels:

1. **Email:** Contact me directly at <gerrxt07@proton.me> with the subject line `Haven Security Vulnerability Report: [Brief Description]`. This inbox is actively monitored, and I prioritize evaluating all inbound reports. 
   * **PGP Encryption:** If you prefer to encrypt your communication, I fully support PGP. You can find my exported public key in this repository (e.g., `public-key.asc`).
2. **GitHub Security Advisory:** You may open a **Private** GitHub Security Advisory directly within this repository. This allows me to collaborate with you privately on the fix before public disclosure.

**⚠️ IMPORTANT: Please DO NOT open a public issue, pull request, or discussion thread regarding unpatched security vulnerabilities.**

### What to Include in Your Report

To help me triage and validate your report as efficiently as possible, please provide detailed information. A high-quality report should include:

* **Vulnerability Description:** A clear, concise description of the vulnerability, its underlying mechanism, and its potential impact.
* **Reproduction Steps:** Step-by-step instructions on how to reliably reproduce the issue. 
* **Proof of Concept (PoC):** Any scripts, malicious payloads, or video demonstrations documenting the exploit in action.
* **Environment Details:** * Operating System and Version (e.g., Windows 11, macOS 14).
  * Electron runtime version and Haven application version.
  * Any relevant network conditions or specific configuration states required for the exploit.

## Disclosure Policy and Timelines

I respect the effort you put into submitting a vulnerability and pledge to handle your report with transparency and speed:

1. **Acknowledgement:** I aim to acknowledge receipt of your vulnerability report within **48 hours**.
2. **Investigation & Triage:** Within **5 business days** of acknowledgement, I will provide an initial assessment of the vulnerability, including its confirmed severity and my expected timeframe for a resolution.
3. **Patching & Mitigation:** I will work diligently to patch the vulnerability. You will be kept informed of my progress throughout the development lifecycle.
4. **Coordinated Disclosure:** Once a fix has been developed, tested, and released to the public, I will work with you to coordinate a public disclosure (if desired), ensuring you receive proper attribution and credit for your discovery.

## Recognition and Rewards

While I do not currently offer a paid Bug Bounty program, I immensely value the work of security researchers. Contributors who responsibly disclose verified, high-impact vulnerabilities will be honored with:

* **Hall of Fame Attribution:** Public recognition and credit on my GitHub Advisories and release manifest notes (including linked Twitter/X or GitHub profiles if requested).

Thank you for helping me keep the Haven community safe and secure!

## The Haven "Hack-The-App" Challenge
Are you a reverse engineer looking for a challenge? I have a dedicated program for testing the client's local defenses. Please see [HACK_THE_APP.md](./HACK_THE_APP.md) for rules and rewards regarding my community "CrackMe" challenge.