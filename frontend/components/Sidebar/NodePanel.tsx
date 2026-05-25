'use client';

import React from 'react';
import { T, ROLES } from '../../theme';
import { GNode, AnalyzeResult } from '../../types';
import BlastRadiusPanel from '../BlastRadiusPanel';

interface NodePanelProps {
  selectedNode: GNode | null;
  data: AnalyzeResult | null;
  handleNodeClick: (node: GNode) => void;
  runBlast: () => void;
  blastLoading: boolean;
  handleAsk: (q: string) => void;
  analyzedUrl: string;
  apiBase: string;
  onHighlight: (ids: Set<string>) => void;
}

export default function NodePanel({
  selectedNode,
  data,
  handleNodeClick,
  handleAsk,
  analyzedUrl,
  apiBase,
  onHighlight,
}: NodePanelProps) {

  // ── Empty state — no node selected ──────────────────────────────────────────
  if (!selectedNode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, paddingTop: 64 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, background: T.bgSurface,
            border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
          }}>
            <i className="ti ti-click" style={{ fontSize: 24, color: T.text }} />
          </div>
          <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, fontWeight: 500 }}>
            Click any node on the graph<br />to inspect its footprint
          </div>
        </div>

        {data && data.stats.top_hubs.length > 0 && (
          <>
            <div style={{
              fontSize: 11, fontFamily: T.sans, fontWeight: 700, color: T.textMuted,
              letterSpacing: '0.05em', marginBottom: 12, textTransform: 'uppercase',
            }}>
              Core Hubs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.stats.top_hubs.slice(0, 6).map(h => {
                const node = data.graph.nodes.find(x => x.id === h.id);
                const roleDef = ROLES[node?.role ?? 'default'] ?? ROLES.default;
                return (
                  <div
                    key={h.id}
                    onClick={() => { if (node) handleNodeClick(node); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12,
                      cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.05)';
                      e.currentTarget.style.borderColor = T.borderMid;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
                      e.currentTarget.style.borderColor = T.border;
                    }}
                  >
                    <span style={{
                      width: 10, height: 10, borderRadius: '50%', background: roleDef.color,
                      flexShrink: 0, boxShadow: `0 0 0 2px ${T.bgSurface}, 0 0 0 4px ${roleDef.bg}`,
                    }} />
                    <span style={{
                      fontSize: 13, fontFamily: T.sans, fontWeight: 600, color: T.text,
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {h.name}
                    </span>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
                      background: T.bgHover, padding: '4px 8px', borderRadius: 100,
                    }}>
                      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.sans, fontWeight: 700 }}>
                        ↑{h.indegree}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Node selected ────────────────────────────────────────────────────────────
  const roleDef = ROLES[selectedNode.role] ?? ROLES.default;

  return (
    <div style={{
      flex: 1, padding: '24px 20px', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', gap: 0,
    }}>

      {/* Role badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px',
        borderRadius: 100, marginBottom: 20, background: T.bgSurface,
        border: `1px solid ${T.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
        color: roleDef.color, fontSize: 12, fontFamily: T.sans, fontWeight: 700,
        alignSelf: 'flex-start',
      }}>
        <i className={`ti ${roleDef.glyph}`} style={{ fontSize: 14 }} />
        {roleDef.label}
      </div>

      {/* File name */}
      <div style={{
        fontSize: 22, fontWeight: 800, color: T.text, marginBottom: 8,
        wordBreak: 'break-all', lineHeight: 1.2, letterSpacing: '-0.02em',
      }}>
        {selectedNode.name}
      </div>

      {/* File path */}
      <div style={{
        fontSize: 13, fontFamily: T.mono, color: T.textDim,
        marginBottom: 24, wordBreak: 'break-all', lineHeight: 1.5,
      }}>
        {selectedNode.path}
      </div>

      {/* Role description */}
      <div style={{
        fontSize: 14, color: T.textMuted, lineHeight: 1.6, padding: '16px',
        background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16,
        marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}>
        {roleDef.desc}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
        {selectedNode.is_hub    && <Tag icon="ti-antenna"           label="Hub"         />}
        {selectedNode.is_entry  && <Tag icon="ti-triangle-inverted" label="Entry point" />}
        {selectedNode.is_orphan && <Tag icon="ti-unlink"            label="Orphan"      />}
        {selectedNode.is_config && <Tag icon="ti-settings-2"        label="Config"      />}
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 28 }}>
        <Metric label="Imports"  value={selectedNode.indegree}          />
        <Metric label="Exports"  value={selectedNode.outdegree}         />
        <Metric label="Role"     value={roleDef.label.slice(0, 4)}      />
      </div>

      {/* ── BLAST RADIUS — full panel ────────────────────────────────────────── */}
      <BlastRadiusPanel
        selectedNode={selectedNode}
        data={data}
        analyzedUrl={analyzedUrl}
        apiBase={apiBase}
        onHighlight={onHighlight}
      />

      <div style={{ height: 1, background: T.border, margin: '8px 0 24px' }} />

      {/* Quick AI prompts */}
      <div style={{
        fontSize: 11, fontFamily: T.sans, fontWeight: 700, color: T.textMuted,
        letterSpacing: '0.05em', marginBottom: 12, textTransform: 'uppercase',
      }}>
        Ask AI
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {([
          selectedNode.is_orphan  ? `Is ${selectedNode.name} safe to delete?`          : null,
          selectedNode.is_hub     ? `What breaks if ${selectedNode.name} changes?`      : null,
          `Explain what ${selectedNode.name} does`,
          selectedNode.indegree > 3 ? `Why is ${selectedNode.name} imported so much?`  : null,
        ] as (string | null)[]).filter(Boolean).map(q => (
          <button
            key={q!}
            onClick={() => handleAsk(q!)}
            style={{
              textAlign: 'left', background: T.bgSurface, border: `1px solid ${T.border}`,
              color: T.textMuted, padding: '14px 16px', borderRadius: 12,
              fontFamily: T.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor  = T.borderMid;
              e.currentTarget.style.color        = T.text;
              e.currentTarget.style.transform    = 'translateY(-1px)';
              e.currentTarget.style.boxShadow    = '0 4px 8px rgba(0,0,0,0.04)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor  = T.border;
              e.currentTarget.style.color        = T.textMuted;
              e.currentTarget.style.transform    = 'translateY(0)';
              e.currentTarget.style.boxShadow    = '0 2px 4px rgba(0,0,0,0.01)';
            }}
          >
            <i className="ti ti-sparkles" style={{ fontSize: 14, color: T.textDim, flexShrink: 0 }} />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: '14px 12px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
    }}>
      <div style={{
        fontSize: 22, fontWeight: 800, color: T.text,
        fontFamily: T.sans, lineHeight: 1, marginBottom: 6,
      }}>
        {value}
      </div>
      <div style={{
        fontSize: 10, fontFamily: T.sans, fontWeight: 700,
        color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </div>
    </div>
  );
}

function Tag({ icon, label }: { icon: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 12px', borderRadius: 100,
      background: T.bgSurface, border: `1px solid ${T.border}`,
      fontSize: 11, fontFamily: T.sans, fontWeight: 600, color: T.text,
      boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 12, color: T.textDim }} />
      {label}
    </span>
  );
}