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
          width: 56, height: 56, borderRadius: 16, background: T.bgSurface,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <i className="ti ti-sitemap" style={{ fontSize: 28, color: T.text }} />
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, textAlign: 'center', fontWeight: 500 }}>
          Analyze a repository first<br/>to generate architecture
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      {archLoading ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 24px',
            border: `3px solid ${T.border}`, borderTopColor: '#111',
            borderRadius: '50%', animation: 'spin 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite',
          }} />
          <div style={{ fontSize: 14, fontFamily: T.sans, fontWeight: 600, color: T.textMuted }}>Building architecture…</div>
        </div>

      ) : arch ? (
        <div style={{ textAlign: 'center', width: '100%', animation: 'fade-up 0.4s ease' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 24px', background: T.bgSurface, border: `1px solid ${T.border}`,
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
          }}>
            <i className="ti ti-check" style={{ fontSize: 28, color: T.text }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 12, letterSpacing: '-0.02em' }}>Diagram ready</div>
          <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, marginBottom: 32 }}>
            The full-screen canvas is now active.<br />Close it to return here.
          </div>
          <button 
            onClick={generateArchitecture} 
            style={{ 
              width: '100%', justifyContent: 'center', gap: 8, height: 48, background: T.bgSurface, border: `1px solid ${T.border}`,
              borderRadius: 100, fontSize: 14, fontWeight: 600, color: T.text, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bgHover; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.bgSurface; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <i className="ti ti-refresh" style={{ fontSize: 16 }} /> Regenerate Diagram
          </button>
        </div>

      ) : (
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 24px', background: T.bgSurface, border: `1px solid ${T.border}`,
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
          }}>
            <i className="ti ti-sitemap" style={{ fontSize: 32, color: T.text }} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 12, letterSpacing: '-0.02em' }}>Architecture diagram</div>
          <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, marginBottom: 40 }}>
            Generate a layered diagram to visualize structural patterns, module boundaries, and flow.
          </div>
          
          <button 
            onClick={generateArchitecture} 
            style={{ 
              width: '100%', justifyContent: 'center', gap: 10, height: 48, background: '#111', color: '#fff', border: 'none', borderRadius: 100,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
          >
            <i className="ti ti-sitemap" style={{ fontSize: 16 }} /> Generate diagram
          </button>
        </div>
      )}
    </div>
  );
}