import { useEffect, useRef } from 'react';

export default function CursorGlow() {
  const glowRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isTouch || reducedMotion) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let rafId = null;

    const onMouseMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${currentX - 260}px, ${currentY - 260}px, 0)`;
      }
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return <div ref={glowRef} className="cursor-ambient-glow" aria-hidden="true" />;
}
