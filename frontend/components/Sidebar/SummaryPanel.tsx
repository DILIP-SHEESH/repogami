import React from 'react';
import { T } from '../../theme';
import { AnalyzeResult } from '../../types';
import SidebarReadme from './SidebarReadme';

interface SummaryPanelProps {
  data: AnalyzeResult | null;
  generateReadme: () => void;
  readmeLoading: boolean;
  readme: string;
  generateArchitecture: () => void;
  archLoading: boolean;
}

export default function SummaryPanel({
  data, generateReadme, readmeLoading, readme, generateArchitecture, archLoading,
}: SummaryPanelProps) {
  if (!data) return null;
  const { summary, stats, meta } = data;

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '24px 20px 0' }}>
        
        {/* Project Header */}
        <div style={{ fontSize: 24, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 6, lineHeight: 1.2 }}>
          {summary.project_name}
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 16, lineHeight: 1.5 }}>
          {summary.tagline}
        </div>

        {/* Repo Link Pill */}
        <a
          href={meta.url} target="_blank" rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
            fontFamily: T.sans, fontWeight: 600, color: T.text, textDecoration: 'none',
            marginBottom: 28, padding: '6px 14px', border: `1px solid ${T.border}`,
            borderRadius: 100, background: T.bgSurface, transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = T.bgHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = T.bgSurface; e.currentTarget.style.transform = 'translateY(0)'; }}
        >
          <i className="ti ti-brand-github" style={{ fontSize: 14 }} />
          {meta.owner}/{meta.repo}
          <i className="ti ti-external-link" style={{ fontSize: 12, color: T.textDim, marginLeft: 2 }} />
        </a>

        {/* Tactile Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
          <StatCard label="Files" value={stats.total_files} />
          <StatCard label="Edges" value={stats.total_edges} />
          <StatCard label="Orphans" value={stats.orphan_count} />
        </div>

        {/* Premium Stack Pills */}
        {summary.tech_stack?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontFamily: T.sans, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
              Tech Stack
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {summary.tech_stack.slice(0, 10).map((t: string) => (
                <span key={t} style={{
                  fontSize: 12, fontFamily: T.sans, fontWeight: 500, color: T.text,
                  background: T.bgSurface, border: `1px solid ${T.border}`, padding: '4px 12px',
                  borderRadius: 100, boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sleek Description Quote */}
        <p style={{
          fontSize: 14, color: T.textMuted, lineHeight: 1.6, margin: '0 0 28px',
          borderLeft: `2px solid #111`, paddingLeft: 16, background: 'linear-gradient(90deg, #f9f9f9 0%, transparent 100%)',
          padding: '16px', borderRadius: '0 12px 12px 0'
        }}>
          {summary.description}
        </p>

        {/* Entry points */}
        {summary.entry_points?.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontFamily: T.sans, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12 }}>
              Entry points
            </div>
            {summary.entry_points.slice(0, 3).map((ep: string) => (
              <div key={ep} style={{
                fontSize: 13, fontFamily: T.sans, fontWeight: 500, color: T.text,
                padding: '6px 0', display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, background: T.bgHover, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <i className="ti ti-triangle-inverted" style={{ fontSize: 12, color: T.text }} />
                </div>
                {ep}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: T.border, margin: '0 0 24px' }} />

        {/* Sleek Architecture Diagram Button */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={generateArchitecture} disabled={archLoading}
            style={{ 
              justifyContent: 'center', gap: 10, width: '100%', height: 48,
              background: '#111', color: '#fff', border: 'none', borderRadius: 100,
              fontSize: 14, fontWeight: 600, cursor: archLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}
            onMouseEnter={e => { if(!archLoading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)'; }}}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
          >
            {archLoading ? (
              <><i className="ti ti-loader-2" style={{ fontSize: 16, animation: 'spin 0.6s linear infinite' }} /> Building diagram…</>
            ) : (
              <><i className="ti ti-sitemap" style={{ fontSize: 16 }} /> Generate Architecture Diagram</>
            )}
          </button>
        </div>
      </div>

      <SidebarReadme readme={readme} readmeLoading={readmeLoading} onGenerate={generateReadme} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16,
      padding: '16px 14px', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      cursor: 'default', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'; e.currentTarget.style.borderColor = T.borderMid; }}
    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; e.currentTarget.style.borderColor = T.border; }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color: T.text, fontFamily: T.sans, lineHeight: 1, marginBottom: 8, letterSpacing: '-0.03em' }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 10, fontFamily: T.sans, fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}