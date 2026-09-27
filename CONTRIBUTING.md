# Contributing to Synapse ⚡

We are thrilled that you want to contribute to **Synapse**! Whether you are reporting a bug, proposing a new tactical feature, or improving documentation, all constructive contributions are welcome.

---

## 🛠️ Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/synapse.git
   cd synapse
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the local signaling server:**
   ```bash
   npm run server
   ```

4. **In a separate terminal, launch the Vite development server:**
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser. Open a secondary tab or browser window to test the P2P connection locally!

---

## 📐 Code Style & Architecture Guidelines

- **Design Philosophy:** We adhere to the **Emil Kowalski Design Engineering** approach — smooth transitions, spring-like physics (`cubic-bezier(0.16, 1, 0.3, 1)`), tactile microinteractions, and dark Cyberpunk aesthetics.
- **WebRTC Best Practices:** 
  - Never store `RTCPeerConnection` or `MediaStream` directly in React `useState` when frequent updates occur. Use `useRef` to prevent unnecessary DOM re-renders and dropped frames.
  - Always clean up tracks, intervals, and transceivers on component unmount to prevent memory leaks.
- **Accessibility:** Ensure high contrast, keyboard navigable controls (`Tab`, `Space`, `Enter`), and screen reader status updates via ARIA live regions.
- **Security:** Do not bypass input sanitization or rate limiting on the WebSocket signaling layer.

---

## 🧪 Verification & Build

Before opening a pull request, verify that the project builds cleanly without errors:

```bash
# Check syntax of server
node --check server.js

# Build client bundle & PWA assets
npm run build
```

---

## 🤝 Submitting a Pull Request

1. Fork the repo and create a new feature branch (`git checkout -b feat/quantum-audio-visualizer`).
2. Commit your changes with clear, descriptive messages (`git commit -m "feat(hud): add audio spectrum visualizer"`).
3. Push to your branch (`git push origin feat/quantum-audio-visualizer`).
4. Open a Pull Request on GitHub describing the motivation and testing steps.

Thank you for helping push the boundaries of real-time P2P screen sharing! 🚀
