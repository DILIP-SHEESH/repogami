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
  data,
  generateReadme,
  readmeLoading,
  readme,
  generateArchitecture,
  archLoading,
}: SummaryPanelProps) {
  if (!data) return null;

  const { summary, stats, meta } = data;

  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Project metadata section */}
      <div style={{ padding: '24px 20px 0' }}>
        {/* Project name */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: T.text,
            letterSpacing: '-0.02em',
            marginBottom: 6,
            lineHeight: 1.2,
          }}
        >
          {summary.project_name}
        </div>
        <div
          style={{
            fontSize: 14,
            color: T.textMuted,
            marginBottom: 16,
            lineHeight: 1.5,
          }}
        >
          {summary.tagline}
        </div>

        {/* Repo link */}
        <a
          href={meta.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontFamily: T.sans,
            fontWeight: 600,
            color: T.text,
            textDecoration: 'none',
            marginBottom: 24,
            padding: '6px 12px',
            border: `1px solid ${T.border}`,
            borderRadius: 100,
            background: T.bgSurface,
            transition: 'background 0.15s'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = T.bgHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = T.bgSurface)}
        >
          <i className="ti ti-brand-github" style={{ fontSize: 14 }} />
          {meta.owner}/{meta.repo}
          <i className="ti ti-external-link" style={{ fontSize: 12, color: T.textDim, marginLeft: 2 }} />
        </a>

        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            marginBottom: 24,
          }}
        >
          <StatCard label="Files" value={stats.total_files} />
          <StatCard label="Edges" value={stats.total_edges} />
          <StatCard
            label="Orphans"
            value={stats.orphan_count}
          />
        </div>

        {/* Tech stack pills */}
        {summary.tech_stack?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: T.sans,
                fontWeight: 600,
                color: T.textMuted,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Stack
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {summary.tech_stack.slice(0, 10).map((t: string) => (
                <span
                  key={t}
                  style={{
                    fontSize: 12,
                    fontFamily: T.sans,
                    fontWeight: 500,
                    color: T.text,
                    background: T.bgHover,
                    border: `1px solid ${T.border}`,
                    padding: '4px 10px',
                    borderRadius: 6,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <p
          style={{
            fontSize: 14,
            color: T.textMuted,
            lineHeight: 1.6,
            margin: '0 0 24px',
            borderLeft: `2px solid ${T.borderHi}`,
            paddingLeft: 16,
            background: T.bgHover,
            padding: '12px 16px',
            borderRadius: '0 8px 8px 0'
          }}
        >
          {summary.description}
        </p>

        {/* Entry points */}
        {summary.entry_points?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11,
                fontFamily: T.sans,
                fontWeight: 600,
                color: T.textMuted,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              Entry points
            </div>
            {summary.entry_points.slice(0, 3).map((ep: string) => (
              <div
                key={ep}
                style={{
                  fontSize: 13,
                  fontFamily: T.sans,
                  fontWeight: 500,
                  color: T.text,
                  padding: '4px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <i className="ti ti-triangle-inverted" style={{ fontSize: 12, color: T.textDim, flexShrink: 0 }} />
                {ep}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: T.border, margin: '0 0 20px' }} />

        {/* Architecture diagram button */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={generateArchitecture}
            disabled={archLoading}
            style={{ 
              justifyContent: 'center', gap: 8, width: '100%',
              background: '#111', color: '#fff', border: 'none', borderRadius: 100,
              padding: '12px', fontSize: 13, fontWeight: 600, cursor: archLoading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', transition: 'opacity 0.15s'
            }}
            onMouseEnter={e => { if(!archLoading) e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            {archLoading ? (
              <>
                <i
                  className="ti ti-loader-2"
                  style={{ fontSize: 14, animation: 'spin 0.6s linear infinite' }}
                />
                Building diagram…
              </>
            ) : (
              <>
                <i className="ti ti-sitemap" style={{ fontSize: 14 }} />
                Generate Architecture Diagram
              </>
            )}
          </button>
        </div>
      </div>

      {/* README viewer */}
      <SidebarReadme
        readme={readme}
        readmeLoading={readmeLoading}
        onGenerate={generateReadme}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        background: T.bgSurface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: '16px 12px 12px',
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: T.text,
          fontFamily: T.sans,
          lineHeight: 1,
          marginBottom: 6,
          letterSpacing: '-0.02em'
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: 10,
          fontFamily: T.sans,
          fontWeight: 600,
          color: T.textDim,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
    </div>
  );
}