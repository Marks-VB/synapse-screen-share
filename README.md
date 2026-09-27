<div align="center">

```
   ███████╗██╗   ██╗███╗   ██╗ █████╗ ██████╗ ███████╗███████╗
   ██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗██╔══██╗██╔════╝██╔════╝
   ███████╗ ╚████╔╝ ██╔██╗ ██║███████║██████╔╝███████╗█████╗  
   ╚════██║  ╚██╔╝  ██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══╝  
   ███████║   ██║   ██║ ╚████║██║  ██║██║     ███████║███████╗
   ╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚══════╝
```

### ⚡ Ultra-Low Latency WebRTC Screen Sharing & Tactical Cyberdeck HUD ⚡

[![License: MIT](https://img.shields.io/badge/License-MIT-00f3ff.svg?style=flat-square)](LICENSE)
[![WebRTC](https://img.shields.io/badge/WebRTC-1080p%2060FPS-39ff14.svg?style=flat-square)](https://webrtc.org/)
[![React 18](https://img.shields.io/badge/React-18.3-61dafb.svg?style=flat-square)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-5.4-bd34fe.svg?style=flat-square)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg?style=flat-square)](https://tailwindcss.com/)
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-ff007f.svg?style=flat-square)](https://web.dev/progressive-web-apps/)
[![Accessibility](https://img.shields.io/badge/WCAG-2.2%20Compliant-39ff14.svg?style=flat-square)](https://www.w3.org/WAI/standards-guidelines/wcag/)

[Live Demo](https://synapse.pages.dev) • [Features](#-key-features) • [Architecture](#-architecture--c4-model) • [Quick Start](#-quick-start) • [Contributing](CONTRIBUTING.md)

</div>

---

## 👁️ Overview

**Synapse** is an ultra-responsive, zero-configuration peer-to-peer screen sharing and real-time collaboration tool built for developers, homelabbers, and gamers who demand fluid **60 FPS transmission** without the bloat, tracking, or subscription tiers of traditional meeting software.

Wrapped in an aggressive **tactical Cyberpunk HUD**, Synapse combines hardware-accelerated WebRTC pipelines, SCTP DataChannel terminal messaging, live network telemetries, and an installable Progressive Web App (PWA) experience.

---

## ✨ Key Features

- 🏎️ **Ultra-Low Latency 60 FPS Video:** Hardware-accelerated screen capture up to 1080p @ 60 FPS with adaptive bitrate control (up to 8,000 kbps).
- 🔒 **End-to-End P2P Privacy:** Audio and video streams flow directly between peers via encrypted DTLS / SRTP. No video frames ever touch the signaling server.
- 💬 **Terminal Chat over DataChannel:** Zero-lag communication channel operating over peer-to-peer `RTCDataChannel` (`synapse-terminal`), independent of external chat servers.
- 📊 **Real-Time Cyberdeck Telemetry:** Live HUD monitoring rendering resolution, actual FPS, bandwidth consumption (Mbps), Round-Trip Time (RTT latency in ms), and packet loss percentage.
- 📱 **Progressive Web App (PWA):** Installs as a standalone native app on Windows, macOS, Linux, Android, and iOS with auto-updating Service Workers and offline shell cache.
- 🎨 **Design-Engineered Tactility:** Emil Kowalski-inspired microinteractions with custom bezier curves (`cubic-bezier(0.16, 1, 0.3, 1)`), tactile click-press mechanics, CRT scanlines, and glow shaders.
- ♿ **Accessible by Design:** Audited against WCAG 2.2 standards, with ARIA live regions for screen readers, high-contrast neon palettes, and full keyboard navigation.
- 🛡️ **Hardened Signaling Core:** WebSocket signaling server armed with connection rate limiting, 64KB max payload caps, strict regex validation, room peer limits, and CSP headers.

---

## 🏛️ Architecture & C4 Model

Synapse is architected with a strict separation between the **Signaling Plane** (room discovery & SDP exchange) and the **Media Plane** (high-speed P2P transmission).

```mermaid
flowchart TD
    subgraph ClientA["Host Operative (Browser A)"]
        SPA_A["Synapse SPA (React + Vite)\n- Screen Capture (1080p60)\n- RTCPeerConnection Manager\n- Tactical HUD"]
    end

    subgraph ClientB["Peer Operative (Browser B)"]
        SPA_B["Synapse SPA (React + Vite)\n- HTML5 Video Renderer (60 FPS)\n- DataChannel Receiver\n- Terminal Chat"]
    end

    subgraph Signaling["Signaling Infrastructure"]
        Server["Node.js + ws Signaling Server\n(Port 3000 / Cloudflare Worker)\n- Room State Management\n- SDP & ICE Relay"]
    end

    subgraph NAT["NAT Traversal"]
        STUN["Public STUN Servers (Google)\n(UDP:19302)"]
    end

    %% Signaling Flow
    SPA_A <== "1. WebSocket (WSS)\n[offer / candidate]" ==> Server
    Server <== "2. WebSocket (WSS)\n[answer / candidate]" ==> SPA_B

    %% ICE Traversal
    SPA_A -. "3. STUN Binding" .-> STUN
    SPA_B -. "3. STUN Binding" .-> STUN

    %% Media Flow (Direct P2P)
    SPA_A <=== "4. Direct P2P SRTP / DTLS\n(Video 1080p60 ~8Mbps + Opus Audio)" ===> SPA_B
    SPA_A <=== "5. SCTP DataChannel\n('synapse-terminal' chat & commands)" ===> SPA_B
```

---

## 💻 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Core** | React 18 + Vite 5 | Modular component architecture & sub-millisecond HMR |
| **Styling & HUD** | Tailwind CSS + Lucide Icons | Cyberpunk design system, responsive HUD, CRT shaders |
| **Real-Time Media** | WebRTC Native APIs | `getDisplayMedia`, `RTCPeerConnection`, `RTCDataChannel` |
| **State Separation** | Dedicated Custom Hooks | [`useWebRTC`](src/hooks/useWebRTC.js), [`useSignaling`](src/hooks/useSignaling.js), [`useMediaStream`](src/hooks/useMediaStream.js) |
| **Offline & PWA** | `vite-plugin-pwa` + Workbox | Auto-updating Service Worker, caching, standalone window |
| **Signaling Server** | Node.js + `express` + `ws` | Lightweight, rate-limited SDP & ICE candidate router |
| **Deployment** | Cloudflare Pages / Workers | Global edge distribution with zero cold-starts |

---

## 🚀 Quick Start

### Prerequisites
- Node.js `>= 18.0.0`
- npm `>= 9.0.0`

### 1. Clone & Install
```bash
git clone https://github.com/your-username/synapse.git
cd synapse
npm install
```

### 2. Run Locally

In your first terminal, start the signaling server:
```bash
npm run server
```

In your second terminal, start the frontend development server:
```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Open a secondary tab or window to test the P2P connection locally in real time!

---

## 📦 Building for Production

Compile the optimized client bundle and PWA service workers into `dist/`:

```bash
npm run build
```

The resulting `dist/` directory can be deployed directly to **Cloudflare Pages**, **Vercel**, **Netlify**, or served statically by `server.js`.

---

## ⌨️ Tactical Controls & Shortcuts

| Action | Control / Location | Shortcut / Description |
| :--- | :--- | :--- |
| **Toggle Stream** | Quantum Dock (Center) | Start / Stop screen capture pipeline |
| **Toggle Microphone** | Quantum Dock (Mic Icon) | Mute / Unmute local input |
| **Toggle Audio Monitor**| Quantum Dock (Headphone) | Deafen / Listen to incoming remote stream |
| **Quality Presets** | Quantum Dock (Pill Selector) | Instant switch: `1080p60`, `720p60`, `720p30` |
| **Terminal / Diagnostics**| Sidebar Switcher | Toggle between peer chat and WebRTC diagnostic log stream |
| **Copy Tactical Link** | Header (Room Badge) | Copies direct room URL with encoded room query param |

---

## 🛡️ Security & Privacy Notice

- **No Relay of Media:** Synapse does not record, buffer, or relay video/audio streams on any server. All transmission occurs directly peer-to-peer over DTLS/SRTP encryption.
- **Recursive Screen Loop Prevention:** Capture pipelines enforce `selfBrowserSurface: 'exclude'` where supported, preventing infinite recursive mirroring of the Synapse tab.
- **Rate-Limited Signaling:** Signaling connections enforce strict message quotas (max 60 msg / 5s) and reject payloads exceeding 64 KB to mitigate DoS risks.
- **Strict Validation:** Room identifiers and SDP payloads undergo rigorous alphanumeric schema validation before being processed.

---

## 🤝 Contributing

Contributions make the open-source community thrive! Whether you are fixing an edge case in WebRTC reconnection, polishing animations, or improving accessibility, your help is appreciated.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

<div align="center">
<sub>Crafted with precision for low-latency transmission. // SYNAPSE MESH 2026</sub>
</div>
