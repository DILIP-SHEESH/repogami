'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { T } from '../../theme';
import { GNode, AnalyzeResult } from '../../types';

interface RingFile {
  id: string;
  name: string;
  path: string;
  role: string;
  indegree: number;
  language: string;
  is_hub: boolean;
  is_entry: boolean;
  is_test: boolean;
}

interface Ring {
  depth: number;
  files: RingFile[];
  file_count: number;
}

interface BlastResult {
  node: string;
  node_name: string;
  node_role: string;
  total_affected: number;
  actual_depth: number;
  affected_files: string[];
  rings: Ring[];
  risk_score: number;
  risk_label: string;
  risk_color: string;
  risk_breakdown: {
    width: number;
    depth: number;
    hubs: number;
    tests: number;
    entry: number;
  };
  hub_files: string[];
  entry_files: string[];
  test_files: string[];
  summary: string;
}

interface Props {
  selectedNode: GNode | null;
  data: AnalyzeResult | null;
  analyzedUrl: string;
  apiBase: string;
  onHighlight?: (nodeIds: Set<string>) => void;
}

// ─── Role colors (matching your existing theme) ───────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  hub:    '#8b5cf6',
  entry:  '#3b82f6',
  shared: '#06b6d4',
  leaf:   '#6b7280',
  orphan: '#f59e0b',
  config: '#10b981',
  test:   '#f97316',
  default:'#6b7280',
};

const RING_COLORS = [
  { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444' },
  { bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)',  text: '#f97316' },
  { bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.25)',   text: '#eab308' },
  { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   text: '#22c55e' },
  { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  text: '#3b82f6' },
];

// ─── Risk score arc component ─────────────────────────────────────────────────

function RiskArc({ score, color, label }: { score: number; color: string; label: string }) {
  const [animated, setAnimated] = useState(0);
  const SIZE    = 120;
  const STROKE  = 10;
  const R       = (SIZE - STROKE) / 2;
  const CIRC    = 2 * Math.PI * R;
  // Arc goes from -210deg to +30deg (240 degree sweep)
  const SWEEP   = 240;
  const offset  = CIRC - (animated / 100) * (CIRC * SWEEP / 360);

  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(150deg)' }}>
        {/* Track */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke={T.border}
          strokeWidth={STROKE}
          strokeDasharray={`${CIRC * SWEEP / 360} ${CIRC}`}
          strokeLinecap="round"
        />
        {/* Progress */}
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeDasharray={`${CIRC * SWEEP / 360} ${CIRC}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      {/* Center text */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        transform: 'translateY(-6px)',
      }}>
        <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em' }}>
          {animated}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, letterSpacing: '0.06em', marginTop: 2 }}>
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ─── Mini breakdown bar ───────────────────────────────────────────────────────

function BreakdownBar({
  label, value, max, color
}: { label: string; value: number; max: number; color: string }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 120);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        width: 52, fontSize: 11, fontWeight: 600, color: T.textMuted,
        textAlign: 'right', flexShrink: 0, letterSpacing: '0.02em',
      }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 6, borderRadius: 100,
        background: T.bgHover, overflow: 'hidden',
      }}>
        <div style={{
          width: `${(w / max) * 100}%`, height: '100%',
          background: color, borderRadius: 100,
          transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
        }} />
      </div>
      <span style={{
        width: 24, fontSize: 11, fontWeight: 700,
        color: T.text, textAlign: 'right', flexShrink: 0,
      }}>
        {value}
      </span>
    </div>
  );
}


function FileChip({ file, onClick }: { file: RingFile; onClick: () => void }) {
  const roleColor = file.is_hub ? ROLE_COLOR.hub
    : file.is_entry ? ROLE_COLOR.entry
    : file.is_test  ? ROLE_COLOR.test
    : ROLE_COLOR[file.role] ?? ROLE_COLOR.default;

  return (
    <button
      onClick={onClick}
      title={file.path}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 10px', borderRadius: 100,
        background: T.bgSurface, border: `1px solid ${T.border}`,
        fontSize: 11, fontWeight: 600, color: T.text,
        cursor: 'pointer', transition: 'all 0.15s ease',
        maxWidth: '100%', overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = roleColor;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: roleColor, flexShrink: 0,
      }} />
      <span style={{
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {file.name}
      </span>
      {file.is_hub   && <span title="Hub"   style={{ fontSize: 9, color: ROLE_COLOR.hub   }}>HUB</span>}
      {file.is_entry && <span title="Entry" style={{ fontSize: 9, color: ROLE_COLOR.entry }}>ENTRY</span>}
    </button>
  );
}

// ─── Concentric ring visualization ───────────────────────────────────────────

function ConcentricRings({
  rings, nodeName, riskColor, onFileClick
}: {
  rings: Ring[];
  nodeName: string;
  riskColor: string;
  onFileClick: (id: string) => void;
}) {
  if (rings.length === 0) return null;

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20,
    }}>
      {/* Origin node */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderRadius: 12,
        background: `${riskColor}15`,
        border: `1.5px solid ${riskColor}40`,
      }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          background: riskColor, flexShrink: 0,
          boxShadow: `0 0 0 4px ${riskColor}20`,
        }} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
          {nodeName}
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 10, fontWeight: 700,
          color: riskColor, letterSpacing: '0.06em',
        }}>
          ORIGIN
        </span>
      </div>

      {/* Connector line */}
      <div style={{
        width: 1, height: 8, background: T.border,
        marginLeft: 20, alignSelf: 'flex-start', flexShrink: 0,
      }} />

      {rings.map((ring, i) => {
        const rc = RING_COLORS[i] ?? RING_COLORS[RING_COLORS.length - 1];
        return (
          <React.Fragment key={ring.depth}>
            <div style={{
              borderRadius: 14, overflow: 'hidden',
              border: `1px solid ${rc.border}`,
              background: rc.bg,
            }}>
              {/* Ring header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderBottom: ring.files.length > 0 ? `1px solid ${rc.border}` : 'none',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%',
                  background: rc.text, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>
                    {ring.depth}
                  </span>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: rc.text }}>
                  Layer {ring.depth}
                </span>
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 600,
                  color: T.textMuted,
                }}>
                  {ring.file_count} file{ring.file_count !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Files in ring */}
              {ring.files.length > 0 && (
                <div style={{
                  padding: '10px 12px', display: 'flex',
                  flexWrap: 'wrap', gap: 6,
                }}>
                  {ring.files.map(f => (
                    <FileChip
                      key={f.id}
                      file={f}
                      onClick={() => onFileClick(f.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Connector between rings */}
            {i < rings.length - 1 && (
              <div style={{
                width: 1, height: 8, background: T.border,
                marginLeft: 20, alignSelf: 'flex-start', flexShrink: 0,
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}


export default function BlastRadiusPanel({
  selectedNode, data, analyzedUrl, apiBase, onHighlight,
}: Props) {
  const [loading, setLoading]     = useState(false);
  const [result,  setResult]      = useState<BlastResult | null>(null);
  const [copied,  setCopied]      = useState(false);
  const [expanded, setExpanded]   = useState<Record<number, boolean>>({});

  // Reset when node changes
  useEffect(() => { setResult(null); }, [selectedNode?.id]);

  const runBlast = useCallback(async () => {
    if (!selectedNode || !data) return;
    setLoading(true); setResult(null);

    try {
      const res = await fetch(`${apiBase}/blast-radius`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          edges:   data.graph.links.map(l => ({
            source: typeof l.source === 'object' ? (l.source as any).id : l.source,
            target: typeof l.target === 'object' ? (l.target as any).id : l.target,
          })),
          node_id: selectedNode.id,
          depth:   5,
          nodes:   data.graph.nodes,
        }),
      });

      const json: BlastResult = await res.json();
      setResult(json);

      // Highlight affected nodes on the graph
      if (onHighlight) {
        const ids = new Set<string>([selectedNode.id, ...json.affected_files]);
        onHighlight(ids);
      }
    } catch (e) {
      console.error('Blast radius failed', e);
    } finally {
      setLoading(false);
    }
  }, [selectedNode, data, apiBase, onHighlight]);

  const handleShare = useCallback(() => {
    if (!result || !selectedNode) return;

    // Build a URL with query params — your /blast page will parse these
    const params = new URLSearchParams({
      repo:  analyzedUrl,
      file:  selectedNode.id,
      score: String(result.risk_score),
      label: result.risk_label,
    });
    const shareUrl = `${window.location.origin}/blast?${params.toString()}`;

    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [result, selectedNode, analyzedUrl]);

  const handleFileClick = useCallback((fileId: string) => {
    if (!data) return;
    const node = data.graph.nodes.find(n => n.id === fileId);
    if (node && onHighlight) {
      onHighlight(new Set([fileId]));
    }
  }, [data, onHighlight]);

  if (!selectedNode) return null;

  if (!result && !loading) {
    return (
      <div style={{ padding: '0 20px 24px' }}>
        <button
          onClick={runBlast}
          style={{
            width: '100%', height: 48, borderRadius: 100,
            background: '#111', color: '#fff', border: 'none',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s cubic-bezier(0.16,1,0.3,1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.18)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)';
          }}
        >
          <i className="ti ti-ripple" style={{ fontSize: 16 }} />
          Calculate Blast Radius
        </button>
        <p style={{
          textAlign: 'center', fontSize: 12,
          color: T.textMuted, marginTop: 12, lineHeight: 1.6,
        }}>
          See exactly what breaks if <strong style={{ color: T.text }}>{selectedNode.name}</strong> changes.
          Traces {5} layers deep.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        padding: 32, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: `3px solid ${T.border}`,
          borderTopColor: '#ef4444',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
          Tracing cascade…
        </span>
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        padding: '20px', borderRadius: 16,
        background: T.bgSurface, border: `1px solid ${T.border}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}>
        <RiskArc
          score={result!.risk_score}
          color={result!.risk_color}
          label={result!.risk_label}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.textMuted, marginBottom: 4 }}>
            {result!.total_affected} file{result!.total_affected !== 1 ? 's' : ''} affected
            across {result!.actual_depth} layer{result!.actual_depth !== 1 ? 's' : ''}
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 100,
            background: `${result!.risk_color}15`,
            border: `1px solid ${result!.risk_color}30`,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: result!.risk_color,
            }} />
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: result!.risk_color, letterSpacing: '0.04em',
            }}>
              {result!.risk_label} Risk
            </span>
          </div>

          {/* Breakdown */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <BreakdownBar label="Width"  value={result!.risk_breakdown.width}  max={35} color={result!.risk_color} />
            <BreakdownBar label="Depth"  value={result!.risk_breakdown.depth}  max={20} color={result!.risk_color} />
            <BreakdownBar label="Hubs"   value={result!.risk_breakdown.hubs}   max={25} color={result!.risk_color} />
            <BreakdownBar label="Tests"  value={result!.risk_breakdown.tests}  max={10} color={result!.risk_color} />
            <BreakdownBar label="Entry"  value={result!.risk_breakdown.entry}  max={10} color={result!.risk_color} />
          </div>
        </div>
      </div>

      {(result!.hub_files.length > 0 || result!.entry_files.length > 0) && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)',
          fontSize: 13, lineHeight: 1.6, color: T.text,
        }}>
          <i className="ti ti-alert-triangle" style={{ color: '#ef4444', marginRight: 8 }} />
          {result!.hub_files.length > 0 && (
            <span>
              <strong>{result!.hub_files.length} hub file{result!.hub_files.length !== 1 ? 's' : ''}</strong> in blast radius.{' '}
            </span>
          )}
          {result!.entry_files.length > 0 && (
            <span>
              <strong>{result!.entry_files.length} entry point{result!.entry_files.length !== 1 ? 's' : ''}</strong> exposed.
            </span>
          )}
        </div>
      )}

      <ConcentricRings
        rings={result!.rings}
        nodeName={result!.node_name}
        riskColor={result!.risk_color}
        onFileClick={handleFileClick}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        {/* Re-run */}
        <button
          onClick={runBlast}
          style={{
            flex: 1, height: 40, borderRadius: 100,
            background: T.bgSurface, color: T.textMuted,
            border: `1px solid ${T.border}`, fontSize: 13,
            fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderMid; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; e.currentTarget.style.borderColor = T.border; }}
        >
          <i className="ti ti-refresh" style={{ fontSize: 14 }} />
          Rerun
        </button>

        {/* Share */}
        <button
          onClick={handleShare}
          style={{
            flex: 2, height: 40, borderRadius: 100,
            background: copied ? '#22c55e' : '#111',
            color: '#fff', border: 'none', fontSize: 13,
            fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.2s ease',
          }}
        >
          <i className={`ti ${copied ? 'ti-check' : 'ti-share'}`} style={{ fontSize: 14 }} />
          {copied ? 'Copied!' : 'Share Blast Radius'}
        </button>
      </div>

      {/* Summary sentence */}
      <p style={{
        fontSize: 12, color: T.textMuted, lineHeight: 1.6,
        background: T.bgSurface, padding: '12px 16px',
        borderRadius: 10, border: `1px solid ${T.border}`,
        fontFamily: 'monospace', margin: 0,
      }}>
        {result!.summary}
      </p>
    </div>
  );
}