import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Languages,
  Mic,
  MicOff,
  PhoneOff,
  Send,
  Trash2,
} from 'lucide-react';
import AudioWaveform from '../components/voice/AudioWaveform.jsx';
import TranscriptPanel from '../components/voice/TranscriptPanel.jsx';
import {
  appendCallMessage,
  endCallSession,
  sendChatMessage,
  startCallSession,
} from '../services/api.js';

const AGENT_STATUSES = ['Ready', 'Listening', 'Processing', 'Speaking', 'Error'];
const LANGUAGES = ['English', 'Hindi'];
const LANGUAGE_CODES = {
  English: 'en-US',
  Hindi: 'hi-IN',
};

function getSpeechRecognitionClass() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function sanitizeForSpeech(text) {
  if (!text) return '';
  return text
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, '')
    .replace(/[*_`#]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function selectVoiceForLanguage(voices, langLabel) {
  if (!voices || voices.length === 0) return null;

  if (langLabel === 'Hindi') {
    return (
      voices.find((v) => v.lang.toLowerCase() === 'hi-in') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('hi-in')) ||
      voices.find((v) => v.lang.toLowerCase().startsWith('hi')) ||
      null
    );
  }

  return (
    voices.find((v) => v.lang.toLowerCase() === 'en-us') ||
    voices.find((v) => v.lang.toLowerCase().startsWith('en-')) ||
    voices[0] ||
    null
  );
}

export default function VoiceAgent() {
  const [status, setStatus] = useState('Ready');
  const [language, setLanguage] = useState('English');
  const [sessionActive, setSessionActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState([]);
  const [voices, setVoices] = useState([]);
  const [qualification, setQualification] = useState(null);
  const [insights, setInsights] = useState(null);
  const [bookedAppt, setBookedAppt] = useState(null);

  const recognitionRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const inFlightRef = useRef(false);
  const sessionActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const languageRef = useRef(language);
  const voicesRef = useRef(voices);
  const noSpeechRetriesRef = useRef(0);
  const sessionIdRef = useRef(`session-${Date.now()}`);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    voicesRef.current = voices;
  }, [voices]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const available = window.speechSynthesis.getVoices();
      if (available.length > 0) {
        setVoices(available);
      }
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  };

  const stopSpeechPlayback = () => {
    isSpeakingRef.current = false;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  const stopRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // Ignore stop errors if recognition already ended
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  const endVoiceSession = () => {
    sessionActiveRef.current = false;
    setSessionActive(false);
    noSpeechRetriesRef.current = 0;
    stopRecognition();
    stopSpeechPlayback();
    stopMediaTracks();
  };

  useEffect(() => {
    return () => {
      endVoiceSession();
    };
  }, []);

  const startRecognitionCycle = () => {
    if (
      !sessionActiveRef.current ||
      inFlightRef.current ||
      isSpeakingRef.current
    ) {
      return;
    }

    const SpeechRecognition = getSpeechRecognitionClass();
    if (!SpeechRecognition) {
      setError(
        'Speech recognition is not supported in this browser. Please use Chrome or Edge, or type a message below.'
      );
      endVoiceSession();
      setStatus('Error');
      return;
    }

    stopRecognition();

    const recognition = new SpeechRecognition();
    recognition.lang = LANGUAGE_CODES[languageRef.current] || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('Listening');
    };

    recognition.onresult = (event) => {
      noSpeechRetriesRef.current = 0;
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      stopRecognition();
      if (transcript.trim()) {
        submitMessage(transcript, true);
      } else if (sessionActiveRef.current) {
        startRecognitionCycle();
      } else {
        setStatus('Ready');
      }
    };

    recognition.onerror = (event) => {
      stopRecognition();
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError(
          'Microphone permission was denied. Please allow microphone access in your browser settings.'
        );
        endVoiceSession();
        setStatus('Error');
        return;
      }

      if (event.error === 'no-speech') {
        if (sessionActiveRef.current && noSpeechRetriesRef.current < 2) {
          noSpeechRetriesRef.current += 1;
          startRecognitionCycle();
          return;
        }
        setError('No speech detected. Click Start Conversation to resume.');
        endVoiceSession();
        setStatus('Ready');
        return;
      }

      if (event.error === 'aborted' && !sessionActiveRef.current) {
        setStatus('Ready');
        return;
      }

      setError(`Speech recognition error: ${event.error}`);
      endVoiceSession();
      setStatus('Error');
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      endVoiceSession();
      setStatus('Error');
    }
  };

  const speakReply = (text, langLabel) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
      if (sessionActiveRef.current) {
        startRecognitionCycle();
      } else {
        setStatus('Ready');
      }
      return;
    }

    const availableVoices =
      voicesRef.current.length > 0
        ? voicesRef.current
        : window.speechSynthesis.getVoices();
    const selectedVoice = selectVoiceForLanguage(availableVoices, langLabel);

    if (langLabel === 'Hindi' && !selectedVoice) {
      setError(
        'No Hindi (hi-IN) voice is installed on this device/browser. To enable Hindi speech, install a Hindi voice in Windows Settings (Time & language → Speech → Add voices) or use Chrome/Edge with Hindi TTS.'
      );
      if (sessionActiveRef.current) {
        startRecognitionCycle();
      } else {
        setStatus('Ready');
      }
      return;
    }

    stopSpeechPlayback();
    const spokenText = sanitizeForSpeech(text);
    if (!spokenText) {
      if (sessionActiveRef.current) {
        startRecognitionCycle();
      } else {
        setStatus('Ready');
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = LANGUAGE_CODES[langLabel] || 'en-US';
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = langLabel === 'Hindi' ? 0.95 : 1.0;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setStatus('Speaking');
    };

    const handleSpeechDone = () => {
      isSpeakingRef.current = false;
      if (sessionActiveRef.current) {
        startRecognitionCycle();
      } else {
        setStatus('Ready');
      }
    };

    utterance.onend = handleSpeechDone;
    utterance.onerror = handleSpeechDone;

    window.speechSynthesis.speak(utterance);
  };

  const submitMessage = async (rawText, shouldSpeak = false) => {
    const trimmed = rawText.trim();
    if (!trimmed || inFlightRef.current) return;

    inFlightRef.current = true;
    setError('');
    setIsLoading(true);
    setStatus('Processing');

    const customerTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), sender: 'customer', text: trimmed, time: customerTime },
    ]);

    startCallSession(sessionIdRef.current)
      .then(() =>
        appendCallMessage(
          sessionIdRef.current,
          'customer',
          trimmed,
          customerTime
        )
      )
      .catch(() => {});

    try {
      const data = await sendChatMessage(
        trimmed,
        languageRef.current,
        sessionIdRef.current
      );
      setQualification({
        progress: data.qualification_progress ?? 0,
        collected: data.collected_fields || {},
        score: data.lead_score ?? 0,
        category: data.lead_category || 'Cold',
        complete: Boolean(data.qualification_complete),
      });
      setInsights({
        sentiment: data.sentiment || 'neutral',
        emotion: data.emotion || 'unknown',
        intent: data.intent || 'general_inquiry',
        buyingSignal: data.buying_signal || 'low',
        requiresHuman: Boolean(data.requires_human),
        reason: data.sentiment_reason || '',
      });
      if (data.appointment) {
        setBookedAppt(data.appointment);
      }
      const aiTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: data.reply,
          time: aiTime,
        },
      ]);

      appendCallMessage(sessionIdRef.current, 'ai', data.reply, aiTime).catch(
        () => {}
      );

      if (shouldSpeak) {
        speakReply(data.reply, languageRef.current);
      } else {
        setStatus('Ready');
      }
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to reach the Voxora AI backend.';
      setError(detail);
      endVoiceSession();
      setStatus('Error');
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleToggleMic = async () => {
    if (isLoading) return;

    if (sessionActiveRef.current) {
      endVoiceSession();
      setStatus('Ready');
      return;
    }

    const SpeechRecognition = getSpeechRecognitionClass();
    if (!SpeechRecognition) {
      setError(
        'Speech recognition is not supported in this browser. Please use Chrome or Edge, or type a message below.'
      );
      setStatus('Error');
      return;
    }

    setError('');
    stopSpeechPlayback();

    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      }
    } catch {
      setError(
        'Microphone permission was denied. Please allow microphone access in your browser settings.'
      );
      setStatus('Error');
      return;
    }

    sessionActiveRef.current = true;
    setSessionActive(true);
    noSpeechRetriesRef.current = 0;
    startRecognitionCycle();
  };

  const handleSendText = (e) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    const text = inputText;
    setInputText('');
    stopSpeechPlayback();
    submitMessage(text, false);
  };

  const handleClear = () => {
    if (isLoading) return;
    endVoiceSession();
    sessionIdRef.current = `session-${Date.now()}`;
    setQualification(null);
    setInsights(null);
    setMessages([]);
    setError('');
    setStatus('Ready');
  };

  const handleEndSession = () => {
    const finishedSessionId = sessionIdRef.current;
    if (messages.length > 0) {
      endCallSession(finishedSessionId, 'completed').catch(() => {});
    }
    endVoiceSession();
    inFlightRef.current = false;
    sessionIdRef.current = `session-${Date.now()}`;
    setQualification(null);
    setInsights(null);
    setBookedAppt(null);
    setIsLoading(false);
    setStatus('Ready');
    setError('');
    setMessages([]);
  };

  const latestAiMessage = [...messages]
    .reverse()
    .find((msg) => msg.sender === 'ai');

  return (
    <div className="page-container">
      <div className="voice-header">
        <div>
          <h2>AI Voice Agent</h2>
          <p>
            Click the microphone to start a continuous two-way voice
            conversation, or type a message below.
          </p>
        </div>

        <div className="voice-controls-top">
          <div className="language-select-wrap">
            <Languages size={16} aria-hidden="true" />
            <select
              aria-label="Select language"
              className="voice-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={sessionActive || isLoading}
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <span
            className={`voice-status-badge ${
              status === 'Error' ? 'voice-status-error' : ''
            }`}
          >
            <span
              className={`status-dot ${
                status === 'Listening' ||
                status === 'Processing' ||
                status === 'Speaking'
                  ? 'status-dot-online'
                  : ''
              }`}
              aria-hidden="true"
            />
            <span>{status}</span>
          </span>
        </div>
      </div>

      <div className="voice-status-bar" aria-label="Agent status">
        {AGENT_STATUSES.map((item) => (
          <button
            key={item}
            type="button"
            className={`status-chip-btn ${
              status === item ? 'status-chip-btn-active' : ''
            }`}
            onClick={() => {
              if (isLoading || sessionActive) return;
              setStatus(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="voice-grid">
        <section className="panel-card voice-stage-card" aria-label="Voice controls">
          <button
            type="button"
            className={`mic-button ${isListening ? 'mic-button-active' : ''}`}
            onClick={handleToggleMic}
            disabled={isLoading}
            aria-label={
              sessionActive ? 'Stop conversation' : 'Start conversation'
            }
          >
            {sessionActive ? <MicOff size={32} /> : <Mic size={32} />}
          </button>
          <p className="mic-caption">
            {isLoading
              ? 'Processing response from Groq...'
              : isListening
                ? `Listening in ${language}...`
                : status === 'Speaking'
                  ? 'Speaking AI response...'
                  : sessionActive
                    ? 'Voice session active'
                    : 'Start Conversation'}
          </p>

          <AudioWaveform
            active={
              status === 'Listening' ||
              status === 'Processing' ||
              status === 'Speaking'
            }
            state={
              status === 'Listening'
                ? 'listening'
                : status === 'Processing'
                  ? 'thinking'
                  : status === 'Speaking'
                    ? 'speaking'
                    : status === 'Error'
                      ? 'error'
                      : 'idle'
            }
            mediaStream={mediaStreamRef.current}
          />

          <div className="ai-response-panel">
            <div className="ai-response-header">
              <Bot size={16} aria-hidden="true" />
              <span>AI Response</span>
            </div>
            <p className="ai-response-text">
              {isLoading
                ? 'Generating reply...'
                : latestAiMessage
                  ? latestAiMessage.text
                  : 'No AI response yet. Start a conversation or send a message.'}
            </p>
          </div>

          <div className="voice-session-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={handleClear}
              disabled={isLoading}
            >
              <Trash2 size={16} aria-hidden="true" />
              <span>Clear Conversation</span>
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleEndSession}
            >
              <PhoneOff size={16} aria-hidden="true" />
              <span>End Session</span>
            </button>
          </div>

          <div className="qualification-panel" aria-label="Lead qualification">
            <div className="qualification-header">
              <span>Lead Qualification</span>
              <span className="status-pill">
                {qualification
                  ? `${qualification.category} (${qualification.score}/100)`
                  : 'Pending'}
              </span>
            </div>
            <div className="qualification-bar">
              <div
                className="qualification-bar-fill"
                style={{ width: `${qualification?.progress ?? 0}%` }}
              />
            </div>
            <div className="qualification-meta">
              <span>Progress: {qualification?.progress ?? 0}%</span>
              <span>
                {qualification?.complete ? 'Complete' : 'In progress'}
              </span>
            </div>
            {qualification &&
              Object.keys(qualification.collected).length > 0 && (
                <ul className="qualification-fields">
                  {Object.entries(qualification.collected).map(([key, val]) => (
                    <li key={key}>
                      <strong>{key.replace(/_/g, ' ')}:</strong> {val}
                    </li>
                  ))}
                </ul>
              )}
            {insights && (
              <div className="qualification-fields">
                {insights.requiresHuman && (
                  <div className="voice-error-banner" role="alert">
                    Human intervention recommended
                  </div>
                )}
                <div>
                  <strong>Sentiment:</strong> {insights.sentiment} ({insights.emotion})
                </div>
                <div>
                  <strong>Intent:</strong> {insights.intent.replace(/_/g, ' ')}
                </div>
                <div>
                  <strong>Buying Signal:</strong> {insights.buyingSignal}
                </div>
                {bookedAppt && (
                  <div className="kb-success-banner">
                    <strong>Demo Booked:</strong> {bookedAppt.appointment_date} at{' '}
                    {bookedAppt.start_time} ({bookedAppt.meeting_type})
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="panel-card voice-transcript-card" aria-label="Live transcript">
          <div className="panel-header">
            <h3 className="panel-title">Live Conversation Transcript</h3>
            <span className="status-pill">{language}</span>
          </div>

          {error && (
            <div className="voice-error-banner" role="alert">
              {error}
            </div>
          )}

          <TranscriptPanel messages={messages} />

          <form className="voice-text-form" onSubmit={handleSendText}>
            <input
              type="text"
              className="voice-text-input"
              placeholder="Type a customer message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="primary-button"
              disabled={isLoading || !inputText.trim()}
            >
              <Send size={16} aria-hidden="true" />
              <span>{isLoading ? 'Sending...' : 'Send'}</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
