import React from 'react';
import { T } from '../../theme';

interface LoadingScreenProps {
  stage: string;
  pct: number;
}

const steps = [
  'Fetching file tree from GitHub…',
  'Parsing dependency graph…',
  'Computing semantic roles…',
  'Building system blueprint…',
];

export default function LoadingScreen({ stage, pct }: LoadingScreenProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg, zIndex: 10, padding: 40,
    }}>
      {/* Premium Ambient Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.4,
        maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 100%)',
      }} />

      {/* Cinematic Scanning line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        backgroundImage: `linear-gradient(90deg, transparent, rgba(17,17,17,0.2), transparent)`,
        top: `${pct}%`, transition: 'top 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        {/* Spinner & Text */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 24px', border: `3px solid ${T.border}`,
            borderTopColor: '#111', borderRadius: '50%', animation: 'spin 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
            boxShadow: `0 4px 16px rgba(0,0,0,0.04)`,
          }} />
          <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8, letterSpacing: '-0.01em' }}>
            {stage || 'Initializing…'}
          </div>
          <div style={{ fontFamily: T.sans, fontSize: 13, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {Math.round(pct)}% complete
          </div>
        </div>

        {/* Fluid Progress bar */}
        <div style={{ height: 6, backgroundColor: T.bgHover, borderRadius: 100, overflow: 'hidden', marginBottom: 40, border: `1px solid ${T.border}` }}>
          <div style={{
            height: '100%', backgroundColor: '#111', borderRadius: 100,
            width: `${pct}%`, transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          }} />
        </div>

        {/* Step list (Bento styling) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: T.bgSurface, padding: 24, borderRadius: 20, border: `1px solid ${T.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.03)' }}>
          {steps.map((s, i) => {
            const done    = pct > (i + 1) * 22;
            const current = stage === s;
            return (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                opacity: done || current ? 1 : 0.4, transition: 'all 0.3s ease',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  border: `1px solid ${done ? T.borderMid : current ? '#111' : T.border}`,
                  backgroundColor: done ? T.bgHover : current ? T.bgSurface : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done
                    ? <i className="ti ti-check" style={{ fontSize: 14, color: T.text }} />
                    : current
                    ? <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#111', display: 'block', animation: 'pulse-dot 1s ease infinite' }} />
                    : null
                  }
                </div>
                <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: current ? 600 : 500, color: done ? T.textMuted : current ? T.text : T.textDim }}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}