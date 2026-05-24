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
          width: 44, height: 44, borderRadius: 10, background: T.bgSurface,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <i className="ti ti-sitemap" style={{ fontSize: 20, color: T.textDim }} />
        </div>
        <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, textAlign: 'center' }}>
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
            width: 48, height: 48, margin: '0 auto 20px',
            border: `1px solid ${T.border}`, borderTopColor: T.cyan,
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
            boxShadow: `0 0 20px ${T.cyan}20`,
          }} />
          <div style={{ fontSize: 11, fontFamily: T.mono, color: T.textMuted }}>Building architecture…</div>
        </div>

      ) : arch ? (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{
            width: 52, height: 52, margin: '0 auto 20px',
            background: `${T.green}14`, border: `1px solid ${T.green}30`,
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ti ti-check" style={{ fontSize: 22, color: T.green }} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>Diagram ready</div>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, marginBottom: 28 }}>
            The full-screen canvas is now active.<br />Close it to return here.
          </div>
          {arch.graph && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
              <Pill value={arch.graph.nodes?.length ?? 0} label="nodes" color={T.cyan} />
              <Pill value={arch.graph.edges?.length ?? 0} label="edges" color={T.purple} />
            </div>
          )}
          <button onClick={generateArchitecture} className="rg-btn" style={{ width: '100%', justifyContent: 'center', gap: 6 }}>
            <i className="ti ti-refresh" style={{ fontSize: 12 }} /> Regenerate
          </button>
        </div>

      ) : (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 20px',
            background: T.bgSurface, border: `1px solid ${T.border}`,
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ti ti-sitemap" style={{ fontSize: 28, color: T.textDim }} />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: T.text, marginBottom: 10 }}>Architecture diagram</div>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.65, marginBottom: 28 }}>
            Generate a layered diagram to visualize structural patterns, module boundaries, and data flow.
          </div>
          <div style={{ textAlign: 'left', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { icon: 'ti-layers-intersect',      label: 'Layer grouping by architectural role' },
              { icon: 'ti-arrows-transfer-down',   label: 'Dependency flow between modules' },
              { icon: 'ti-zoom-in',                label: 'Click-to-inspect individual nodes' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12, color: T.textMuted }}>
                <i className={`ti ${item.icon}`} style={{ fontSize: 13, color: T.textDim, flexShrink: 0 }} />
                {item.label}
              </div>
            ))}
          </div>
          <button onClick={generateArchitecture} className="rg-btn primary" style={{ width: '100%', justifyContent: 'center', gap: 6, height: 38 }}>
            <i className="ti ti-sitemap" style={{ fontSize: 14 }} /> Generate diagram
          </button>
        </div>
      )}
    </div>
  );
}

function Pill({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{
      background: `${color}14`, border: `1px solid ${color}28`,
      borderRadius: 6, padding: '6px 14px', display: 'flex', alignItems: 'baseline', gap: 5,
    }}>
      <span style={{ fontSize: 16, fontWeight: 600, color, fontFamily: T.mono }}>{value}</span>
      <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono }}>{label}</span>
    </div>
  );
}