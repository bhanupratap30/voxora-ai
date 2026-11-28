import { useEffect, useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import MagneticCursor from '../animations/MagneticCursor.jsx';
import ParticleNetwork from '../animations/ParticleNetwork.jsx';
import AudioWaveform from '../voice/AudioWaveform.jsx';
import '../../styles/auth.css';

const ROTATING_PHRASES = [
  'Smarter Conversations.',
  'Intelligent Lead Qualification.',
  'AI-Powered Sales Automation.',
];

export default function AuthLayout({ children }) {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhraseIdx((prev) => (prev + 1) % ROTATING_PHRASES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="auth-split-shell">
      <ParticleNetwork />
      <MagneticCursor />
      <div className="auth-bg-orb auth-bg-orb-1" aria-hidden="true" />
      <div className="auth-bg-orb auth-bg-orb-2" aria-hidden="true" />

      <svg className="auth-neural-svg" viewBox="0 0 800 600" aria-hidden="true">
        <line x1="80" y1="120" x2="320" y2="260" stroke="#A78BFA" strokeWidth="1" />
        <line x1="320" y1="260" x2="540" y2="160" stroke="#8B5CF6" strokeWidth="1" />
        <line x1="320" y1="260" x2="220" y2="470" stroke="#A78BFA" strokeWidth="1" />
        <circle cx="80" cy="120" r="3" fill="#A78BFA" />
        <circle cx="320" cy="260" r="4" fill="#8B5CF6" />
        <circle cx="540" cy="160" r="3" fill="#A78BFA" />
      </svg>

      <section className="auth-showcase" aria-label="Voxora AI overview">
        <div className="auth-brand">
          <span className="auth-brand-dot" aria-hidden="true" />
          <span>Voxora AI</span>
        </div>

        <div className="auth-hero-copy">
          <div className="auth-rotating-pill">
            <Sparkles size={14} aria-hidden="true" />
            <span>{ROTATING_PHRASES[phraseIdx]}</span>
          </div>
          <h1 className="auth-hero-title">
            Turn Every Conversation Into an Opportunity.
          </h1>
          <p className="auth-hero-desc">
            Voxora AI automates sales conversations in English and Hindi,
            qualifies leads in real time, and converts prospects into booked
            demos.
          </p>
        </div>

        <div className="auth-orb-stage" aria-hidden="true">
          <div className="auth-float-card auth-float-1">
            <span className="auth-brand-dot" style={{ width: 8, height: 8 }} />
            <span>AI Voice Agent – Active</span>
          </div>
          <div className="auth-float-card auth-float-2">
            <span>Lead Qualified – High Intent</span>
          </div>
          <div className="auth-float-card auth-float-3">
            <span>Conversation Intelligence – Processing</span>
          </div>
          <div className="auth-ai-orb">
            <Bot size={32} color="#F8FAFC" />
            <AudioWaveform active />
          </div>
        </div>
      </section>

      <main className="auth-form-pane">
        <div className="auth-glass-card">{children}</div>
      </main>
    </div>
  );
}
