# CaptionRoom ✨ with Gemma 4

> **Live multilingual classroom captions, real-time code-mixing translation, and an interactive Gemma 4 linguistic AI companion.**

---

## 🌟 Key Features

### 1. User-Friendly, Modern UI
- **Responsive 3-Pane Participant Grid**:
  - **👩‍🏫 Ms. Rao (Teacher)**: Primary speaker with live typing or microphone input.
  - **👨‍🎓 Aman (Student)**: Interactive student pane with Hindi / Hinglish responses.
  - **📽️ Projector View (Shared Screen)**: Large-screen shared display with simulated 40 ms network latency.
- **Visual Status & Telemetry**:
  - Live indicators for connection, speaking, and overlap detection (`⚡ Overlap`, `⚠️ Interrupted`, `v2 Revision`).
  - Word-level confidence highlighting (amber dashed line for uncertain words ending in `?`).
  - One-click inline word corrections with instant synchronized propagation.
- **Theme Switcher**: Instant toggle between Dark and Light themes with persistent preferences.

### 2. Fully Functional Real-Time Caption & Translation Engine
- **In-Place Hypothesis Streaming**: Real-time revisions without repeating lines.
- **Code-Mixing (Hinglish) Support**: Handles mixed English & Hindi sentences seamlessly, translating only the parts that need translation.
- **Resilient Reconnection**: Disconnected clients catch up only on what they missed when rejoining, blocking duplicate packets.
- **Web Speech API**: Real microphone speech recognition for both English and Hindi.
- **Telemetry Dashboard**: Live tracking of median and 95th-percentile caption and translation latency.
- **Multi-Format Exports**: Preview and download transcripts directly as `.txt`, `.srt`, `.vtt`, or `.json`.

### 3. Integrated Gemma 4 AI Assistant
- **Floating Option Beside Every Translation**:
  - Each translation line features an animated floating **`✨ Ask Gemma 4`** pill button.
  - Clicking inspects that exact sentence in the Gemma 4 Assistant drawer.
- **Cute Animated Mascot**:
  - Adorable custom animated SVG mascot in the bottom-right corner.
  - Features blinking eyes, hovering bob animation, glowing antenna star, and interactive speech bubbles.
  - Pleasant audio chimes powered by the Web Audio API.
- **Interactive Translation Q&A**:
  - Users can ask Gemma 4 questions about any translation:
    - 🔍 *Why was it translated this way?*
    - 📖 *Word-by-word vocabulary & anatomical breakdown*
    - 🗣️ *Phonetic pronunciation guide (IAST / Hinglish)*
    - 🔄 *Alternative formal vs. conversational phrasing*
    - 🇮🇳 *Code-mixing (Hinglish) linguistic and cognitive impact*
    - 🌱 *Scientific concept explanations (e.g. Photosynthesis equations)*
  - Freeform query box for custom questions.
  - Text-to-Speech (TTS) integration with voice read-out for translations and Gemma's answers.

---

## 🚀 How to Run

1. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari):
   ```bash
   # Or double-click index.html in file explorer
   ```
2. Or serve locally with any static web server:
   ```bash
   npx serve .
   ```

---

## 📁 File Structure

- `index.html` – Modern semantic markup with accessibility attributes and SVG icons.
- `style.css` – Complete styling, glassmorphism, responsive grid, and mascot animations.
- `app.js` – CaptionRoom core engine, Web Speech API, exports, and event delegation.
- `gemma.js` – Gemma 4 linguistic AI engine, animated mascot SVG, Q&A reasoning, and speech synthesis.
