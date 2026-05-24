// SummaryPanel.tsx
import React from 'react';
import { T } from '../../theme';
import { AnalyzeResult } from '../../types';
import SidebarReadme from './SidebarReadme'; // adjust path as needed

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
      <div style={{ padding: '20px 16px 0' }}>
        {/* Project name */}
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: T.text,
            letterSpacing: '-0.025em',
            marginBottom: 4,
            lineHeight: 1.2,
          }}
        >
          {summary.project_name}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: T.textMuted,
            marginBottom: 12,
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
            gap: 5,
            fontSize: 10.5,
            fontFamily: T.mono,
            color: T.cyan,
            textDecoration: 'none',
            marginBottom: 16,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
        >
          <i className="ti ti-brand-github" style={{ fontSize: 12 }} />
          {meta.owner}/{meta.repo}
          <i className="ti ti-external-link" style={{ fontSize: 10 }} />
        </a>

        {/* Stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 6,
            marginBottom: 16,
          }}
        >
          <StatCard label="Files" value={stats.total_files} />
          <StatCard label="Edges" value={stats.total_edges} />
          <StatCard
            label="Orphans"
            value={stats.orphan_count}
            accent={stats.orphan_count > 0 ? T.amber : undefined}
          />
        </div>

        {/* Tech stack pills */}
        {summary.tech_stack?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: T.mono,
                color: T.textDim,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 7,
              }}
            >
              Stack
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {summary.tech_stack.slice(0, 10).map((t: string) => (
                <span
                  key={t}
                  style={{
                    fontSize: 10.5,
                    fontFamily: T.mono,
                    color: T.textMuted,
                    background: T.bgSurface,
                    border: `1px solid ${T.border}`,
                    padding: '2px 7px',
                    borderRadius: 4,
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
            fontSize: 12.5,
            color: T.textMuted,
            lineHeight: 1.7,
            margin: '0 0 20px',
            borderLeft: `2px solid ${T.border}`,
            paddingLeft: 12,
          }}
        >
          {summary.description}
        </p>

        {/* Entry points */}
        {summary.entry_points?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: T.mono,
                color: T.textDim,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: 7,
              }}
            >
              Entry points
            </div>
            {summary.entry_points.slice(0, 3).map((ep: string) => (
              <div
                key={ep}
                style={{
                  fontSize: 11,
                  fontFamily: T.mono,
                  color: T.green,
                  padding: '3px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <i className="ti ti-triangle-inverted" style={{ fontSize: 9, flexShrink: 0 }} />
                {ep}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: T.border, margin: '0 0 14px' }} />

        {/* Architecture diagram button (keep as is) */}
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={generateArchitecture}
            disabled={archLoading}
            className="rg-btn primary"
            style={{ justifyContent: 'center', gap: 6, width: '100%' }}
          >
            {archLoading ? (
              <>
                <i
                  className="ti ti-loader-2"
                  style={{ fontSize: 12, animation: 'spin 0.8s linear infinite' }}
                />
                Building diagram…
              </>
            ) : (
              <>
                <i className="ti ti-sitemap" style={{ fontSize: 12 }} />
                Generate Architecture Diagram
              </>
            )}
          </button>
        </div>
      </div>

      {/* README viewer (replaces old inline readme) */}
      <SidebarReadme
        readme={readme}
        readmeLoading={readmeLoading}
        onGenerate={generateReadme}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: T.bgSurface,
        border: `1px solid ${T.border}`,
        borderRadius: 8,
        padding: '10px 10px 8px',
      }}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: accent ?? T.text,
          fontFamily: T.mono,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: 9.5,
          fontFamily: T.mono,
          color: T.textDim,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
    </div>
  );
}