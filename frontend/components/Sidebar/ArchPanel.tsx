import React from 'react';
import { T } from '../../theme';
import { AnalyzeResult, ArchResult } from '../../types';

interface ArchPanelProps {
  data: AnalyzeResult | null;
  arch: ArchResult | null;
  archLoading: boolean;
  generateArchitecture: () => void;
}

export default function ArchPanel({ data, arch, archLoading, generateArchitecture }: ArchPanelProps) {
  if (!data) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12, background: T.bgSurface,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <i className="ti ti-sitemap" style={{ fontSize: 24, color: T.textDim }} />
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, textAlign: 'center', fontWeight: 500 }}>
          Analyze a repository first<br/>to generate architecture
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {archLoading ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, margin: '0 auto 20px',
            border: `2px solid ${T.border}`, borderTopColor: T.text,
            borderRadius: '50%', animation: 'spin 0.6s linear infinite',
          }} />
          <div style={{ fontSize: 12, fontFamily: T.sans, fontWeight: 600, color: T.textMuted }}>Building architecture…</div>
        </div>

      ) : arch ? (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto 20px',
            background: T.bgSurface, border: `1px solid ${T.border}`,
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.04)'
          }}>
            <i className="ti ti-check" style={{ fontSize: 24, color: T.text }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text, marginBottom: 8, letterSpacing: '-0.01em' }}>Diagram ready</div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 28 }}>
            The full-screen canvas is now active.<br />Close it to return here.
          </div>
          {arch.graph && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
              <Pill value={arch.graph.nodes?.length ?? 0} label="nodes" />
              <Pill value={arch.graph.edges?.length ?? 0} label="edges" />
            </div>
          )}
          <button 
            onClick={generateArchitecture} 
            style={{ 
              width: '100%', justifyContent: 'center', gap: 6,
              background: T.bgSurface, border: `1px solid ${T.border}`,
              padding: '10px', borderRadius: 100, fontSize: 13, fontWeight: 600,
              color: T.text, cursor: 'pointer', transition: 'background 0.15s',
              display: 'flex', alignItems: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
            onMouseLeave={e => e.currentTarget.style.background = T.bgSurface}
          >
            <i className="ti ti-refresh" style={{ fontSize: 14 }} /> Regenerate
          </button>
        </div>

      ) : (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 20px',
            background: T.bgSurface, border: `1px solid ${T.border}`,
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}>
            <i className="ti ti-sitemap" style={{ fontSize: 28, color: T.text }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 10, letterSpacing: '-0.01em' }}>Architecture diagram</div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
            Generate a layered diagram to visualize structural patterns, module boundaries, and data flow.
          </div>
          <div style={{ textAlign: 'left', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: 'ti-layers-intersect',      label: 'Layer grouping by architectural role' },
              { icon: 'ti-arrows-transfer-down',   label: 'Dependency flow between modules' },
              { icon: 'ti-zoom-in',                label: 'Click-to-inspect individual nodes' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
                <div style={{ width: 28, height: 28, background: T.bgHover, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={`ti ${item.icon}`} style={{ fontSize: 14, color: T.text }} />
                </div>
                {item.label}
              </div>
            ))}
          </div>
          <button 
            onClick={generateArchitecture} 
            style={{ 
              width: '100%', justifyContent: 'center', gap: 8, height: 44,
              background: '#111', color: '#fff', border: 'none', borderRadius: 100,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'opacity 0.15s',
              display: 'flex', alignItems: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <i className="ti ti-sitemap" style={{ fontSize: 16 }} /> Generate diagram
          </button>
        </div>
      )}
    </div>
  );
}

function Pill({ value, label }: { value: number; label: string }) {
  return (
    <div style={{
      background: T.bgHover, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'baseline', gap: 6,
    }}>
      <span style={{ fontSize: 16, fontWeight: 700, color: T.text, fontFamily: T.sans }}>{value}</span>
      <span style={{ fontSize: 11, color: T.textDim, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
    </div>
  );
}