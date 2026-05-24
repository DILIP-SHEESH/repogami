import React from 'react';
import { T } from '../../theme';

const features = [
  { glyph: 'ti-topology-star-3', color: T.cyan,   title: '3D Dependency Graph', desc: 'Live force-directed visualization of every import relationship' },
  { glyph: 'ti-ripple',          color: T.purple,  title: 'Blast Radius',        desc: 'Know exactly what breaks if a file changes or is removed' },
  { glyph: 'ti-sitemap',         color: T.amber,   title: 'Architecture Diagram',desc: 'Layered system diagram generated from actual structure' },
  { glyph: 'ti-sparkles',        color: T.pink,    title: 'AI Code Intelligence',desc: 'Ask questions about any file with full dependency context' },
];

export default function EmptyState() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: T.bg, padding: '40px 24px', overflow: 'auto',
    }}>
      {/* Grid texture */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
        backgroundSize: '40px 40px', opacity: 0.4,
        maskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 50%, black 40%, transparent 100%)',
      }} />

      {/* Glow */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 600, height: 300, borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(ellipse, ${T.cyan}08 0%, transparent 70%)`,
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 680 }}>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: T.bgSurface, border: `1px solid ${T.border}`,
          borderRadius: 999, padding: '5px 14px 5px 10px',
          marginBottom: 36, fontSize: 11,
          fontFamily: T.mono, color: T.textMuted,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: T.green, display: 'inline-block',
            animation: 'pulse-dot 2s ease infinite',
          }} />
          System ready · connect a repository
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(32px, 5vw, 56px)',
          fontWeight: 600,
          lineHeight: 1.08,
          letterSpacing: '-0.04em',
          color: T.text,
          marginBottom: 20,
          fontFamily: T.sans,
        }}>
          Understand any codebase
          <br />
          <span style={{
            fontFamily: T.serif, fontStyle: 'italic',
            color: T.textMuted, fontWeight: 400,
          }}>in seconds.</span>
        </h1>

        <p style={{
          color: T.textMuted, fontSize: 15, lineHeight: 1.65,
          maxWidth: 460, margin: '0 auto 56px',
          fontWeight: 400,
        }}>
          Paste a GitHub URL above to generate a live 3D dependency graph,
          layered architecture diagram, and an AI-powered codebase summary.
        </p>

        {/* Feature cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))',
          gap: 12, maxWidth: 680, margin: '0 auto',
        }}>
          {features.map(f => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>

        {/* Example repos */}
        <div style={{ marginTop: 48, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, alignSelf: 'center' }}>try →</span>
          {['vercel/next.js', 'vitejs/vite', 'shadcn-ui/ui'].map(r => (
            <RepoChip key={r} name={r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ glyph, color, title, desc }: { glyph: string; color: string; title: string; desc: string }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.bgSurface : T.bgElevated,
        border: `1px solid ${hov ? T.borderMid : T.border}`,
        borderRadius: 12, padding: '20px 18px',
        textAlign: 'left', transition: 'all 0.18s ease',
        transform: hov ? 'translateY(-2px)' : 'none',
        cursor: 'default',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8,
        background: `${color}18`, border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 14, color,
      }}>
        <i className={`ti ${glyph}`} style={{ fontSize: 18 }} />
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text, marginBottom: 6, lineHeight: 1.3 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: T.textMuted, lineHeight: 1.55 }}>{desc}</div>
    </div>
  );
}

function RepoChip({ name }: { name: string }) {
  return (
    <button
      onClick={() => {
        const input = document.querySelector('.rg-url-input') as HTMLInputElement;
        if (input) { input.value = name; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); }
      }}
      style={{
        background: T.bgSurface, border: `1px solid ${T.border}`,
        borderRadius: 6, padding: '4px 10px',
        fontFamily: T.mono, fontSize: 11, color: T.textMuted,
        cursor: 'pointer', transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.color = T.text; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
    >
      {name}
    </button>
  );
}