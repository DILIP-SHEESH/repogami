import React, { useCallback } from 'react';
import { T } from '../../theme';

const features = [
  { icon: 'ti-dna-2',              title: 'Repo DNA Card',       desc: 'Personality + viral headline + copy-paste tweet. Built to post.' },
  { icon: 'ti-hand-stop',          title: 'Touch Index',         desc: 'Click any file → see what % of the graph ripples if you edit it.' },
  { icon: 'ti-compass',            title: 'Contributor Compass', desc: 'Ordered reading path for cold onboarding — entry to gravity well.' },
  { icon: 'ti-ripple',             title: 'Blast Radius',        desc: 'Shareable /blast links with risk rings for Slack and PR review.' },
  { icon: 'ti-heart-rate-monitor', title: 'Codebase Vitals',     desc: '0–100 health from import physics. Smell radar. Refactor playbook.' },
  { icon: 'ti-topology-star-3',    title: '3D Dependency Graph', desc: 'See hub gravity wells in space before you ship the PR.' },
];

const EXAMPLE_REPOS = ['vercel/next.js', 'vitejs/vite', 'shadcn-ui/ui', 'trpc/trpc'];

interface EmptyStateProps {
  onTryRepo?: (repo: string) => void;
}

export default function EmptyState({ onTryRepo }: EmptyStateProps) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'flex-start',
      background: T.bg, 
      padding: 'clamp(60px, 10vh, 120px) clamp(20px, 4vw, 32px) clamp(20px, 4vh, 40px)', 
      overflowY: 'auto', overflowX: 'hidden'
    }}>
      {/* Background Ambient Glow */}
      <div className="rg-hero-glow" />

      {/* Premium Fine Grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(${T.border} 1px, transparent 1px),
          linear-gradient(90deg, ${T.border} 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        opacity: 0.6,
        maskImage: 'radial-gradient(ellipse 90% 90% at 50% 30%, black 15%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse 90% 90% at 50% 30%, black 15%, transparent 80%)',
        zIndex: 0
      }} />

      {/* Main Content Container */}
      <div style={{ 
        position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 1200, width: '100%',
        display: 'flex', flexDirection: 'column', flex: 1 
      }}>
        
        <div style={{ marginTop: 'clamp(20px, 6vh, 80px)' }}>
          {/* Hero Headline */}
          <h1 className="rg-animate-fade-up delay-1" style={{
            fontSize: 'clamp(44px, 8vw, 84px)',
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.05em',
            color: T.text,
            marginBottom: 24,
            fontFamily: T.sans,
          }}>
            See what breaks <br className="hide-mobile" />
            <span style={{ color: T.textDim, display: 'inline-block' }}>before you ship.</span>
          </h1>

          {/* Hero Subheadline */}
          <p className="rg-animate-fade-up delay-2" style={{
            color: T.textMuted, fontSize: 'clamp(16px, 2.5vw, 20px)', lineHeight: 1.6,
            maxWidth: 620, margin: '0 auto 48px',
            fontWeight: 400, letterSpacing: '-0.01em',
          }}>
            Paste a GitHub URL. Get a 3D import graph, Touch Index per file, Repo DNA you can post on X,
            and a Contributor Compass for onboarding — in under a minute. No login.
          </p>

          {/* Example Repos */}
          <div className="rg-animate-fade-up delay-2" style={{ 
            display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', 
            alignItems: 'center', marginBottom: 'clamp(64px, 10vh, 96px)' 
          }}>
            <span style={{ fontSize: 13, color: T.textDim, fontWeight: 500, marginRight: 8, letterSpacing: '-0.01em' }}>
              Try an example:
            </span>
            {EXAMPLE_REPOS.map(r => <RepoChip key={r} name={r} onTry={onTryRepo} />)}
          </div>

          {/* Bento Feature Grid (4 in a row on desktop) */}
          <div className="rg-animate-fade-up delay-3" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
            gap: 20, maxWidth: 1200, margin: '0 auto',
            textAlign: 'left'
          }}>
            {features.map((f, i) => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>

        {/* Spacer to push footer to bottom */}
        <div style={{ flex: 1, minHeight: 'clamp(40px, 8vh, 120px)' }} />

        {/* Sleek Footer */}
        <footer className="rg-animate-fade-up delay-3" style={{
          display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'center',
          padding: '24px 0 0 0', borderTop: `1px solid ${T.border}`,
          marginTop: 'auto', width: '100%'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="rg-logo-mark" style={{ width: 24, height: 24, borderRadius: 6, fontSize: 12 }}>R</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, letterSpacing: '-0.01em' }}>
              © 2026 Repogami. All rights reserved.
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" className="rg-footer-link">Documentation</a>
            <a href="#" className="rg-footer-link">Privacy</a>
            <a href="#" className="rg-footer-link">Terms</a>
            <a href="#" className="rg-footer-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-brand-github" style={{ fontSize: 16 }} /> GitHub
            </a>
          </div>
        </footer>

      </div>
      
      {/* Minor inline styles for footer hover states */}
      <style>{`
        .rg-footer-link {
          font-size: 13px; font-weight: 600; color: ${T.textMuted}; 
          text-decoration: none; transition: color 0.15s; font-family: ${T.sans};
        }
        .rg-footer-link:hover { color: ${T.text}; }
      `}</style>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div
      className="rg-glass-card"
      style={{
        background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 20, 
        padding: 'clamp(20px, 3vw, 32px)', position: 'relative', overflow: 'hidden',
        cursor: 'default', display: 'flex', flexDirection: 'column',
      }}
    >
      <div 
        className="rg-icon-box"
        style={{
          width: 48, height: 48, borderRadius: 14, marginBottom: 20,
          background: '#f8f8f8', border: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.text,
        }}
      >
        <i className={`ti ${icon}`} style={{ fontSize: 22, strokeWidth: 1.5 }} />
      </div>
      <h3 style={{ 
        fontSize: 'clamp(15px, 1.8vw, 17px)', fontWeight: 700, color: T.text, 
        marginBottom: 10, letterSpacing: '-0.02em', fontFamily: T.sans 
      }}>{title}</h3>
      <p style={{ 
        fontSize: 'clamp(13px, 1.5vw, 14px)', color: T.textMuted, lineHeight: 1.6, fontWeight: 400
      }}>{desc}</p>
    </div>
  );
}

function RepoChip({ name, onTry }: { name: string; onTry?: (repo: string) => void }) {
  const fill = useCallback(() => {
    if (onTry) {
      onTry(name);
      return;
    }
    const input = document.querySelector('.rg-url-input') as HTMLInputElement;
    if (input) {
      input.value = name;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    }
  }, [name, onTry]);

  return (
    <button
      onClick={fill} className="rg-chip-hover"
      style={{
        background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '10px 18px',
        fontFamily: T.mono, fontSize: 13, color: T.text, fontWeight: 500, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.background = T.bgHover; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border;   e.currentTarget.style.background = T.bgSurface; }}
    >
      <i className="ti ti-brand-github" style={{ fontSize: 15, opacity: 0.7 }} />
      {name}
    </button>
  );
}