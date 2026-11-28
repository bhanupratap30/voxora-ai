import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';

export default function MagneticCursor() {
  const glowRef = useRef(null);
  const trailRef = useRef(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let glowX = targetX;
    let glowY = targetY;
    let trailX = targetX;
    let trailY = targetY;
    let rafId = null;
    let activeMagnetic = null;

    const onMouseMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;

      const el = e.target?.closest?.('.primary-button, .auth-btn-primary, .sidebar-link-active');
      if (activeMagnetic && activeMagnetic !== el) {
        activeMagnetic.style.transform = '';
        activeMagnetic = null;
      }
      if (el) {
        const rect = el.getBoundingClientRect();
        const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.14;
        const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.14;
        el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
        activeMagnetic = el;
      }
    };

    const tick = () => {
      glowX += (targetX - glowX) * 0.12;
      glowY += (targetY - glowY) * 0.12;
      trailX += (targetX - trailX) * 0.24;
      trailY += (targetY - trailY) * 0.24;

      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${glowX - 240}px, ${glowY - 240}px, 0)`;
      }
      if (trailRef.current) {
        trailRef.current.style.transform = `translate3d(${trailX - 18}px, ${trailY - 18}px, 0)`;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (activeMagnetic) activeMagnetic.style.transform = '';
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <>
      <div ref={glowRef} className="cursor-ambient-glow" aria-hidden="true" />
      <div
        ref={trailRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 36,
          height: 36,
          borderRadius: '9999px',
          pointerEvents: 'none',
          zIndex: 1,
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.28) 0%, transparent 72%)',
          willChange: 'transform',
        }}
      />
    </>
  );
}
