import React, { useCallback } from 'react';
import { T } from '../../theme';

const features = [
  { icon: 'ti-topology-star-3', title: '3D Dependency Graph',  desc: 'Every file. Every import. Force-directed and live.' },
  { icon: 'ti-ripple',          title: 'Blast Radius',         desc: 'Know exactly what breaks before you touch anything.' },
  { icon: 'ti-sitemap',         title: 'Architecture Diagram', desc: 'Layered system map, auto-generated from structure.' },
  { icon: 'ti-sparkles',        title: 'AI Code Intelligence', desc: 'Ask questions. Get answers with full repo context.' },
];

const EXAMPLE_REPOS = ['vercel/next.js', 'vitejs/vite', 'shadcn-ui/ui', 'trpc/trpc'];

export default function EmptyState() {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: T.bg, padding: 'clamp(20px, 4vw, 32px)', overflowY: 'auto', overflowX: 'hidden'
    }}>
      {/* Fine grid - Lightened for B&W theme */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(${T.border} 1px, transparent 1px),
          linear-gradient(90deg, ${T.border} 1px, transparent 1px)
        `,
        backgroundSize: '44px 44px',
        opacity: 0.4,
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)',
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 800, width: '100%', marginTop: 'clamp(60px, 10vh, 100px)' }}>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(32px, 6vw, 64px)',
          fontWeight: 700,
          lineHeight: 1.1,
          letterSpacing: '-0.04em',
          color: T.text,
          marginBottom: 'clamp(12px, 2vw, 16px)',
          fontFamily: T.sans,
        }}>
          Understand any codebase.
        </h1>

        <p style={{
          color: T.textMuted, fontSize: 'clamp(15px, 2.5vw, 18px)', lineHeight: 1.5,
          maxWidth: 500, margin: '0 auto clamp(32px, 5vw, 48px)',
          fontWeight: 400, letterSpacing: '-0.01em',
        }}>
          Paste a GitHub URL above to generate a live 3D dependency graph,
          layered architecture diagram, and AI-powered summary.
        </p>

        {/* Example repo pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 'clamp(40px, 6vw, 64px)' }}>
          <span style={{ fontSize: 12, color: T.textDim, fontWeight: 500 }}>Try an example:</span>
          {EXAMPLE_REPOS.map(r => <RepoChip key={r} name={r} />)}
        </div>

        {/* Feature grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 16, maxWidth: 800, margin: '0 auto',
        }}>
          {features.map(f => <FeatureCard key={f.title} {...f} />)}
        </div>

      </div>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.bgSurface,
        border: `1px solid ${hov ? T.borderHi : T.border}`,
        borderRadius: 16, padding: 'clamp(16px, 3vw, 24px)',
        textAlign: 'left', transition: 'all 0.2s ease',
        cursor: 'default',
        boxShadow: hov ? `0 8px 24px rgba(0,0,0,0.06)` : '0 2px 8px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 10, marginBottom: 16,
        background: '#f5f5f5', border: `1px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#111'
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
      </div>
      <div style={{ fontSize: 'clamp(13px, 2vw, 14px)', fontWeight: 600, color: T.text, marginBottom: 8, letterSpacing: '-0.01em' }}>{title}</div>
      <div style={{ fontSize: 'clamp(12px, 1.8vw, 13px)', color: T.textMuted, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}

function RepoChip({ name }: { name: string }) {
  const fill = useCallback(() => {
    const input = document.querySelector('.rg-url-input') as HTMLInputElement;
    if (input) {
      input.value = name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  }, [name]);
  return (
    <button
      onClick={fill}
      style={{
        background: T.bgSurface, border: `1px solid ${T.border}`,
        borderRadius: 100, padding: '8px 16px',
        fontFamily: T.mono, fontSize: 12, color: T.text, fontWeight: 500,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.background = T.bgHover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border;   e.currentTarget.style.background = T.bgSurface; }}
    >
      {name}
    </button>
  );
}