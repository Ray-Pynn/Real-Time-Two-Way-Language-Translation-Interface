# Real-Time Two-Way Language Translation Platform

A responsive, full-stack multilingual communication prototype enabling two users to converse in different languages 
across a single device or separate connected devices. Built as an offline-first portfolio project for software engineering resumes 
and recruiter presentations.

## 🛠️ Tech Stack
* **Frontend**: React.js, Vite, JavaScript (ES6+), Lucide React, CSS3, Web Speech API, MediaRecorder API
* **Backend**: Python, FastAPI, WebSockets, Uvicorn, Pydantic, Python-Multipart


---


## ✨ Key Features
* **Dual Conversation Modes**: Supports same-device split interaction and multi-device WebSocket rooms.
* **Speech Integration**: Browser-native SpeechRecognition for voice-to-text input, SpeechSynthesis for text-to-speech audio playback, and MediaRecorder for live audio capture.
* **Real-Time WebSocket Synchronization**: Instant bidirectional message broadcasting across connected client sessions.
* **Offline-First Architecture**: Runs entirely locally without requiring internet connections, cloud servers, or paid third-party API keys.

---

## ⚠️ Important Prototype Limitations & Known Constraints

To satisfy zero-cost and offline-first constraints, this application is built strictly as a **software prototype** and includes the following specific limits:

1. **Deterministic Phrasebook Limitation (Translation Scope)**:
   * The backend translation service does **not** use paid cloud APIs (like Google Translate or DeepL). 
   * Instead, it relies on a **local, hardcoded phrasebook dictionary** inside the backend (`main.py`). 
   * **Only exact pre-configured words and phrases** (such as *"hello"*, *"how are you"*, and *"thank you"*) return actual translated dictionary values. 
   * For **any other words or custom text**, the system automatically triggers a **simulated fallback response and did not crash the project ** (e.g., formatting the text as `[target_language] your text`) rather than performing real neural machine translation.

2. **Simulated Audio Transcription**:
   * The audio upload endpoint (`POST /api/transcribe`) accepts raw microphone recordings via `FormData` but returns a simulated transcript string for portfolio demonstration purposes.

3. **In-Memory State & Session Scope**:
   * Active rooms and conversation transcripts are stored strictly in-memory or in browser state. 
   * Reloading the page or restarting the backend clears the conversation history, as no persistent SQL database is attached.

---

## 📁 Project Structure
```text
real-time-language-translator/
├── README.md
├── .gitignore
├── backend/
│   ├── main.py
│   └── requirements.txt
└── frontend/
    ├── .env
    ├── index.html
    ├── package.json
    ├── style.css
    └── src/
        └── App.jsx


