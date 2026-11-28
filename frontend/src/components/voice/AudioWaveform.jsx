import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

const BASE_BARS = [24, 42, 62, 38, 76, 54, 82, 44, 66, 34, 52, 28];

export default function AudioWaveform({ active = false, state = 'idle', mediaStream = null }) {
  const reducedMotion = useReducedMotion();
  const [liveBars, setLiveBars] = useState(BASE_BARS);
  const rafRef = useRef(null);

  const resolvedState = state !== 'idle' ? state : active ? 'listening' : 'idle';

  useEffect(() => {
    if (reducedMotion || resolvedState !== 'listening' || !mediaStream) {
      return undefined;
    }

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return undefined;

    let audioCtx = null;
    let source = null;
    let analyser = null;

    try {
      audioCtx = new AudioCtx();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source = audioCtx.createMediaStreamSource(mediaStream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next = BASE_BARS.map((_, idx) => {
          const val = data[idx % data.length] || 0;
          return Math.max(18, Math.min(100, Math.round((val / 255) * 100)));
        });
        setLiveBars(next);
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    } catch {
      // Fallback to CSS animation if AudioContext is blocked
    }

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
      if (source) {
        try {
          source.disconnect();
        } catch {
          // Ignore disconnect errors
        }
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [resolvedState, mediaStream, reducedMotion]);

  const isAnimating =
    !reducedMotion &&
    (resolvedState === 'listening' ||
      resolvedState === 'thinking' ||
      resolvedState === 'speaking');

  const bars = resolvedState === 'listening' && mediaStream ? liveBars : BASE_BARS;

  return (
    <div
      className={`waveform ${isAnimating ? 'waveform-active' : ''} waveform-${resolvedState}`}
      aria-label={`Audio waveform ${resolvedState}`}
    >
      {bars.map((height, index) => (
        <span
          key={index}
          className="waveform-bar"
          style={{
            height: `${resolvedState === 'error' ? 18 : height}%`,
            animationDelay: `${index * 0.08}s`,
          }}
        />
      ))}
    </div>
  );
}
