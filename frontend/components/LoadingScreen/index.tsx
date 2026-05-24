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
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: T.bg, zIndex: 10, padding: 40,
    }}>
      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.25,
      }} />

      {/* Scanning line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        background: `linear-gradient(90deg, transparent, ${T.cyan}60, transparent)`,
        top: `${pct}%`, transition: 'top 0.6s ease',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380 }}>

        {/* Spinner */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 24px',
            border: `1px solid ${T.border}`,
            borderTopColor: T.cyan,
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
            boxShadow: `0 0 20px ${T.cyan}20`,
          }} />
          <div style={{
            fontFamily: T.mono, fontSize: 11, letterSpacing: '0.1em',
            color: T.textMuted, marginBottom: 4,
          }}>
            {stage || 'Initializing…'}
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.textDim }}>
            {Math.round(pct)}% complete
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 2, background: T.bgSurface, borderRadius: 2,
          overflow: 'hidden', marginBottom: 28,
        }}>
          <div style={{
            height: '100%', background: `linear-gradient(90deg, ${T.cyanDim}, ${T.cyan})`,
            width: `${pct}%`, transition: 'width 0.5s ease',
            boxShadow: `0 0 8px ${T.cyan}60`,
          }} />
        </div>

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((s, i) => {
            const done    = pct > (i + 1) * 22;
            const current = stage === s;
            return (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: done || current ? 1 : 0.28,
                transition: 'opacity 0.3s',
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  border: `1px solid ${done ? T.green : current ? T.cyan : T.border}`,
                  background: done ? `${T.green}20` : current ? `${T.cyan}15` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done
                    ? <i className="ti ti-check" style={{ fontSize: 9, color: T.green }} />
                    : current
                    ? <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.cyan, display: 'block', animation: 'pulse-dot 1s ease infinite' }} />
                    : null
                  }
                </div>
                <span style={{
                  fontFamily: T.mono, fontSize: 11,
                  color: done ? T.textMuted : current ? T.text : T.textDim,
                }}>
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