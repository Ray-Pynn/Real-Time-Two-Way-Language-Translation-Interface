
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  AudioLines,
  Copy,
  Languages,
  Link2,
  Mic,
  MessageCircle,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Square,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Trash2,
  Upload,
} from "lucide-react";

const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const LANGUAGES = [
  { code: "hi-IN", name: "Hindi" },
  { code: "mr-IN", name: "Marathi" },
  { code: "ta-IN", name: "Tamil" },
  { code: "te-IN", name: "Telugu" },
  { code: "bn-IN", name: "Bengali" },
  { code: "gu-IN", name: "Gujarati" },
  { code: "kn-IN", name: "Kannada" },
  { code: "ml-IN", name: "Malayalam" },
  { code: "pa-IN", name: "Punjabi" },
  { code: "en-US", name: "English" },
];

function makeId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function App() {
  const [mode, setMode] = useState("same");
  const [sourceLanguage, setSourceLanguage] = useState("hi-IN");
  const [targetLanguage, setTargetLanguage] = useState("mr-IN");
  const [speaker, setSpeaker] = useState("A");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [roomInput, setRoomInput] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [connection, setConnection] = useState("disconnected");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("Ready for a conversation.");
  const [health, setHealth] = useState("checking");

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const socketRef = useRef(null);
  const audioUrlRef = useRef("");
  const localId = useRef(makeId());

  useEffect(() => {
    fetch(`${API}/api/health`)
      .then((response) => {
        if (!response.ok) throw new Error("Backend unavailable");
        return response.json();
      })
      .then(() => setHealth("online"))
      .catch(() => setHealth("offline"));

    return () => {
      if (socketRef.current) socketRef.current.close();
      if (recognitionRef.current) recognitionRef.current.stop();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const addMessage = (message) => {
    setMessages((previous) => [message, ...previous].slice(0, 100));
  };

  const speakText = (value, language) => {
    if (!speaking || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.lang = language;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  };

  const connectRoom = (code) => {
    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setError("Enter a room code first.");
      return;
    }
    if (socketRef.current) socketRef.current.close();

    setError("");
    setConnection("connecting");
    setRoomCode(cleanCode);
    const wsBase = API.replace(/^http/, "ws");
    const socket = new WebSocket(`${wsBase}/ws/${encodeURIComponent(cleanCode)}`);

    socket.onopen = () => {
      setConnection("connected");
      setNotice(`Connected to room ${cleanCode}.`);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "system") {
        setNotice(data.message);
        return;
      }
      if (data.type === "conversation" && data.senderId !== localId.current) {
        const incoming = {
          id: data.id || makeId(),
          speaker: data.speaker || "Remote",
          original: data.original,
          translated: data.translated,
          sourceLanguage: data.sourceLanguage,
          targetLanguage: data.targetLanguage,
          time: data.time || new Date().toLocaleTimeString(),
          remote: true,
        };
        addMessage(incoming);
        speakText(incoming.translated, incoming.targetLanguage);
      }
    };

    socket.onerror = () => {
      setError("Room connection failed. Check that the backend is running.");
      setConnection("disconnected");
    };

    socket.onclose = () => {
      setConnection("disconnected");
    };

    socketRef.current = socket;
  };

  const createRoom = () => {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    setRoomInput(code);
    connectRoom(code);
  };

  const translateAndSend = async (originalText) => {
    const cleanText = originalText.trim();
    if (!cleanText) {
      setError("Please enter or speak something first.");
      return;
    }
    setError("");
    try {
      const response = await fetch(`${API}/api/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          source_language: sourceLanguage,
          target_language: targetLanguage,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Translation request failed.");
      }

      const result = await response.json();
      const message = {
        id: makeId(),
        speaker: mode === "same" ? speaker : "You",
        original: result.original_text,
        translated: result.translated_text,
        sourceLanguage,
        targetLanguage,
        translationType: result.translation_type,
        time: new Date().toLocaleTimeString(),
        remote: false,
      };

      addMessage(message);
      speakText(result.translated_text, targetLanguage);
      setText("");

      if (
        mode === "two" &&
        socketRef.current?.readyState === WebSocket.OPEN
      ) {
        socketRef.current.send(
          JSON.stringify({
            type: "conversation",
            ...message,
            senderId: localId.current,
          })
        );
      }

      setNotice(
        result.translation_type === "simulated-fallback"
          ? "Demo fallback used. This is not an actual translation."
          : "Demo phrasebook response received."
      );
    } catch (err) {
      setError(err.message || "Unable to process the message.");
    }
  };

  const startRecording = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone requires HTTPS or localhost in a supported browser.");
      return;
    }
    if (!window.MediaRecorder) {
      setError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const supported = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));

      const recorder = supported
        ? new MediaRecorder(stream, { mimeType: supported })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size) {
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          setAudioUrl(url);
          setRecordedBlob(blob);
        }
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setNotice("Microphone recording started.");
    } catch (err) {
      setError(
        err.name === "NotAllowedError"
          ? "Microphone permission denied. Allow access in browser settings."
          : err.message || "Unable to access the microphone."
      );
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const sendAudioForTranscription = async () => {
    if (!recordedBlob) {
      setError("No audio recorded to transcribe.");
      return;
    }
    setIsTranscribing(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", recordedBlob, "recording.webm");
      formData.append("language", sourceLanguage);

      const response = await fetch(`${API}/api/transcribe`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail || "Transcription request failed.");
      }

      const data = await response.json();
      setText(data.transcript);
      setNotice("Audio transcribed successfully. Ready to translate.");
    } catch (err) {
      setError(err.message || "Failed to transcribe audio.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const startSpeechRecognition = () => {
    setError("");
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError(
        "Speech recognition is not supported in this browser. Use the text box instead."
      );
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = sourceLanguage;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setNotice("Listening for speech...");
    };

    recognition.onresult = (event) => {
      const recognized = event.results[0][0].transcript;
      setText(recognized);
      setNotice("Speech recognized. Press Translate to continue.");
    };

    recognition.onerror = (event) => {
      setError(`Speech recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  };

  const clearConversation = () => {
    setMessages([]);
    setNotice("Conversation cleared.");
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setNotice("Room code copied.");
    } catch {
      setError("Clipboard access unavailable. Copy the room code manually.");
    }
  };

  const sourceName =
    LANGUAGES.find((language) => language.code === sourceLanguage)?.name;
  const targetName =
    LANGUAGES.find((language) => language.code === targetLanguage)?.name;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon"><Languages size={23} /></div>
          <div>
            <h1>Live<span>Translator</span></h1>
            <p>Two-way conversation demo</p>
          </div>
        </div>
        <div className="top-status">
          <span className={`status-indicator ${health}`} />
          Backend {health}
        </div>
      </header>

      <section className="hero">
        <div className="hero-tag"><Radio size={15} /> LOCAL DEMONSTRATION</div>
        <h2>Speak naturally.<br /><span>Understand each other.</span></h2>
        <p>
          A portfolio prototype demonstrating multilingual conversation,
          speech capture and real-time text exchange.
        </p>
      </section>

      <section className="mode-switch">
        <button
          className={mode === "same" ? "mode active" : "mode"}
          onClick={() => setMode("same")}
        >
          <Smartphone size={18} /> Same phone
        </button>
        <button
          className={mode === "two" ? "mode active" : "mode"}
          onClick={() => setMode("two")}
        >
          <Wifi size={18} /> Two phones
        </button>
      </section>

      <section className="language-panel panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CONVERSATION SETUP</span>
            <h3>Choose languages</h3>
          </div>
          <Languages size={22} />
        </div>
        <div className="language-row">
          <div className="language-field">
            <label htmlFor="source-language">Speaker A speaks</label>
            <select
              id="source-language"
              value={sourceLanguage}
              onChange={(event) => setSourceLanguage(event.target.value)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </div>
          <button className="swap-button" onClick={swapLanguages} aria-label="Swap languages">
            <ArrowLeftRight size={20} />
          </button>
          <div className="language-field">
            <label htmlFor="target-language">Translate into</label>
            <select
              id="target-language"
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
            >
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="language-note">
          {sourceName} <ArrowLeftRight size={13} /> {targetName}
        </p>
      </section>

      {mode === "same" ? (
        <section className="panel speaker-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">ONE DEVICE</span>
              <h3>Conversation speakers</h3>
            </div>
            <MessageCircle size={22} />
          </div>
          <div className="speaker-cards">
            <button
              className={speaker === "A" ? "speaker-card selected" : "speaker-card"}
              onClick={() => setSpeaker("A")}
            >
              <span className="speaker-avatar">A</span>
              <strong>Speaker A</strong>
              <small>{sourceName}</small>
              {speaker === "A" && <span className="selected-label">Selected</span>}
            </button>
            <button
              className={speaker === "B" ? "speaker-card selected" : "speaker-card"}
              onClick={() => setSpeaker("B")}
            >
              <span className="speaker-avatar speaker-b">B</span>
              <strong>Speaker B</strong>
              <small>{targetName}</small>
              {speaker === "B" && <span className="selected-label">Selected</span>}
            </button>
          </div>
          <p className="helper-text">
            Select the person who is speaking. Swap the languages when the
            other person replies.
          </p>
        </section>
      ) : (
        <section className="panel room-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MULTI-DEVICE</span>
              <h3>Conversation room</h3>
            </div>
            <Link2 size={22} />
          </div>
          <div className="room-actions">
            <button className="primary-button" onClick={createRoom}>
              Create room
            </button>
            <div className="room-join">
              <input
                value={roomInput}
                onChange={(event) => setRoomInput(event.target.value.toUpperCase())}
                placeholder="Enter room code"
                maxLength={30}
              />
              <button className="secondary-button" onClick={() => connectRoom(roomInput)}>
                Join
              </button>
            </div>
          </div>
          {roomCode && (
            <div className="room-code">
              <div>
                <small>ROOM CODE</small>
                <strong>{roomCode}</strong>
              </div>
              <button onClick={copyRoomCode} aria-label="Copy room code">
                <Copy size={18} />
              </button>
            </div>
          )}
          <p className="connection-status">
            {connection === "connected"
              ? <><Wifi size={15} /> Connected</>
              : connection === "connecting"
              ? "Connecting..."
              : <><WifiOff size={15} /> Not connected</>}
          </p>
          <p className="helper-text">
            Both devices must connect to the same running backend. This demo
            exchanges text messages, not live audio streams.
          </p>
        </section>
      )}

      <section className="panel input-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">VOICE & TEXT INPUT</span>
            <h3>Send a message</h3>
          </div>
          <Mic size={22} />
        </div>
        <div className="input-controls">
          <button
            className="icon-action"
            onClick={startSpeechRecognition}
            title="Browser speech recognition"
          >
            <Mic size={19} />
            Recognize speech
          </button>
          {!recording ? (
            <button className="icon-action" onClick={startRecording}>
              <AudioLines size={19} />
              Record audio
            </button>
          ) : (
            <button className="icon-action recording-action" onClick={stopRecording}>
              <Square size={17} />
              Stop recording
            </button>
          )}
        </div>

        {audioUrl && (
          <div className="audio-preview">
            <span>Recorded audio preview</span>
            <audio controls src={audioUrl}>
              Audio playback is not supported.
            </audio>

            <button
              className="icon-action"
              onClick={sendAudioForTranscription}
              disabled={isTranscribing}
              style={{ marginTop: "8px" }}
            >
              <Upload size={16} />
              {isTranscribing ? "Transcribing audio..." : "Transcribe recorded audio"}
            </button>
          </div>
        )}

        <label className="text-label" htmlFor="message-input">
          Type or edit your recognized words
        </label>
        <textarea
          id="message-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Enter a message in ${sourceName}...`}
          rows={3}
          maxLength={2000}
        />
        <button
          className="translate-button"
          onClick={() => translateAndSend(text)}
          disabled={!text.trim()}
        >
          <Send size={18} /> Translate and send
        </button>
        <div className="voice-setting">
          <div>
            {speaking ? <Volume2 size={18} /> : <VolumeX size={18} />}
            <span>Speak translated text aloud</span>
          </div>
          <button
            className={`toggle ${speaking ? "on" : ""}`}
            onClick={() => setSpeaking((value) => !value)}
            aria-label="Toggle voice playback"
          >
            <span />
          </button>
        </div>
      </section>

      {error && <div className="alert error" role="alert">{error}</div>}
      <div className="notice"><ShieldCheck size={16} /> {notice}</div>

      <section className="panel transcript-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">CONVERSATION HISTORY</span>
            <h3>Transcript</h3>
          </div>
          <button className="clear-button" onClick={clearConversation}>
            <Trash2 size={16} /> Clear
          </button>
        </div>

        {messages.length === 0 ? (
          <div className="empty-state">
            <MessageCircle size={30} />
            <strong>No messages yet</strong>
            <span>Your conversation will appear here.</span>
          </div>
        ) : (
          <div className="message-list">
            {messages.map((message) => (
              <article className="message-card" key={message.id}>
                <div className="message-meta">
                  <strong>{message.speaker}</strong>
                  {message.remote && <span className="remote-label">Remote</span>}
                  <time>{message.time}</time>
                </div>
                <span className="message-language">Original ({message.sourceLanguage})</span>
                <p>{message.original}</p>
                <div className="translation-result">
                  <span>Translated ({message.targetLanguage})</span>
                  <p>{message.translated}</p>
                </div>
                {message.translationType === "simulated-fallback" && (
                  <small className="simulation-note">Demo Fallback Used</small>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
      
      <footer className="footer">
        <p>LiveTranslator Platform • Multilingual Real-Time Communication Prototype</p>
      </footer>
    </main>
  );
}

export default App;
