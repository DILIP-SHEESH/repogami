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
      backgroundColor: T.bg, zIndex: 10, padding: 40,
    }}>
      {/* Subtle grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
        backgroundSize: '48px 48px', opacity: 0.5,
      }} />

      {/* Scanning line */}
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        backgroundImage: `linear-gradient(90deg, transparent, rgba(17,17,17,0.3), transparent)`,
        top: `${pct}%`, transition: 'top 0.6s ease',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 400 }}>

        {/* Spinner & Text */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 24px',
            border: `2px solid ${T.border}`,
            borderTopColor: T.text,
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            boxShadow: `0 4px 12px rgba(0,0,0,0.03)`,
          }} />
          <div style={{
            fontFamily: T.sans, fontSize: 14, fontWeight: 600,
            color: T.text, marginBottom: 6,
          }}>
            {stage || 'Initializing…'}
          </div>
          <div style={{ fontFamily: T.sans, fontSize: 12, color: T.textDim, fontWeight: 500 }}>
            {Math.round(pct)}% complete
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, backgroundColor: T.border, borderRadius: 100,
          overflow: 'hidden', marginBottom: 32,
        }}>
          <div style={{
            height: '100%', backgroundColor: T.text, borderRadius: 100,
            width: `${pct}%`, transition: 'width 0.5s ease',
          }} />
        </div>

        {/* Step list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((s, i) => {
            const done    = pct > (i + 1) * 22;
            const current = stage === s;
            return (
              <div key={s} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                opacity: done || current ? 1 : 0.3,
                transition: 'opacity 0.3s',
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: `1px solid ${done ? T.borderMid : current ? T.text : T.border}`,
                  backgroundColor: done ? T.bgHover : current ? T.bgSurface : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {done
                    ? <i className="ti ti-check" style={{ fontSize: 12, color: T.text }} />
                    : current
                    ? <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: T.text, display: 'block', animation: 'pulse-dot 1s ease infinite' }} />
                    : null
                  }
                </div>
                <span style={{
                  fontFamily: T.sans, fontSize: 13, fontWeight: current ? 600 : 500,
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