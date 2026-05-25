'use client';

import React from 'react';
import { T } from '../../theme';
import { AnalyzeResult, GNode } from '../../types';
import SharePack from './SharePack';
import ContributorCompass from './ContributorCompass';

interface VitalsPanelProps {
  data: AnalyzeResult;
  analyzedUrl?: string;
  onInspectIds?: (ids: string[]) => void;
  onInspectNode?: (node: GNode) => void;
}

const SEVERITY: Record<string, { color: string; bg: string; label: string }> = {
  high:   { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  label: 'HIGH' },
  medium: { color: '#f97316', bg: 'rgba(249,115,22,0.08)', label: 'MED' },
  low:    { color: '#eab308', bg: 'rgba(234,179,8,0.08)',  label: 'LOW' },
};

const IMPACT_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#6b7280',
};

export default function VitalsPanel({ data, analyzedUrl, onInspectIds, onInspectNode }: VitalsPanelProps) {
  const vitals = data.vitals;
  if (!vitals) return null;

  const { health_score, health_grade, health_color, tagline, metrics, layers, smell_radar, refactor_playbook } = vitals;
  const layerMax = Math.max(...Object.values(layers), 1);
  const dna = data.repo_dna;

  const inspectPlaybook = (targetId?: string) => {
    if (!targetId || !onInspectNode) return;
    const node = data.graph.nodes.find(n => n.id === targetId);
    if (node) onInspectNode(node);
  };

  return (
    <div style={{ marginBottom: 28 }}>
      {data.repo_dna && analyzedUrl && <SharePack data={data} analyzedUrl={analyzedUrl} />}

      {data.contributor_compass && data.contributor_compass.length > 0 && (
        <ContributorCompass
          steps={data.contributor_compass}
          nodes={data.graph.nodes}
          onInspectNode={onInspectNode}
        />
      )}

      {dna && (
        <div style={{
          padding: '14px 16px', borderRadius: 14, marginBottom: 16,
          background: T.bgSurface, border: `1px solid ${T.border}`,
        }}>
          <span style={{ fontSize: 20, marginRight: 8 }}>{dna.personality.emoji}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{dna.personality.type}</span>
          <p style={{ fontSize: 12, color: T.textMuted, margin: '8px 0 0', lineHeight: 1.55 }}>
            {dna.personality.one_liner}
          </p>
        </div>
      )}

      <div style={{
        fontSize: 11, fontFamily: T.sans, fontWeight: 700, color: T.textMuted,
        letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <i className="ti ti-heart-rate-monitor" style={{ fontSize: 14 }} />
        Codebase Vitals
      </div>

      {/* Health ring + tagline */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center', padding: 16,
        background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16,
        marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
      }}>
        <HealthRing score={health_score} color={health_color} label={health_grade} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: health_color, marginBottom: 6 }}>
            {health_grade} · {health_score}/100
          </div>
          <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55, margin: 0 }}>
            {tagline}
          </p>
        </div>
      </div>

      {/* Metric chips */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        <MetricChip label="Coupling" value={String(metrics.coupling_index)} hint="edges per file" />
        <MetricChip label="Orphans" value={`${metrics.orphan_ratio_pct}%`} hint="disconnected" />
        <MetricChip label="Hub load" value={`${metrics.hub_concentration_pct}%`} hint="deps on hubs" />
        <MetricChip label="2-cycles" value={String(metrics.mutual_import_pairs)} hint="mutual imports" />
      </div>

      {/* Layer bars */}
      {Object.keys(layers).length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textDim, marginBottom: 8, letterSpacing: '0.06em' }}>
            LAYER MAP
          </div>
          {Object.entries(layers).slice(0, 6).map(([layer, count]) => (
            <div key={layer} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, width: 72, textTransform: 'capitalize' }}>
                {layer}
              </span>
              <div style={{ flex: 1, height: 6, background: T.bgHover, borderRadius: 100, overflow: 'hidden' }}>
                <div style={{
                  width: `${(count / layerMax) * 100}%`, height: '100%',
                  background: layer === metrics.dominant_layer ? '#111' : T.borderMid,
                  borderRadius: 100, transition: 'width 0.6s ease',
                }} />
              </div>
              <span style={{ fontSize: 10, fontFamily: T.mono, color: T.textDim, width: 28, textAlign: 'right' }}>
                {count}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Smell radar */}
      {smell_radar.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.textDim, marginBottom: 8, letterSpacing: '0.06em' }}>
            SMELL RADAR
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {smell_radar.map(smell => {
              const sev = SEVERITY[smell.severity] ?? SEVERITY.low;
              return (
                <button
                  key={smell.id}
                  type="button"
                  onClick={() => smell.inspect_ids.length && onInspectIds?.(smell.inspect_ids)}
                  style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                    background: sev.bg, border: `1px solid ${sev.color}33`,
                    cursor: smell.inspect_ids.length ? 'pointer' : 'default',
                    transition: 'transform 0.15s ease',
                  }}
                  onMouseEnter={e => { if (smell.inspect_ids.length) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: sev.color, letterSpacing: '0.08em' }}>
                      {sev.label}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{smell.title}</span>
                    {smell.inspect_ids.length > 0 && (
                      <i className="ti ti-focus-2" style={{ fontSize: 14, color: T.textDim, marginLeft: 'auto' }} />
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: T.textMuted, margin: 0, lineHeight: 1.5 }}>{smell.detail}</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Refactor playbook */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.textDim, marginBottom: 8, letterSpacing: '0.06em' }}>
          REFACTOR PLAYBOOK
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {refactor_playbook.map((item, i) => (
            <div
              key={`${item.action}-${i}`}
              onClick={() => inspectPlaybook(item.target_id)}
              style={{
                padding: '12px 14px', borderRadius: 12,
                background: T.bgSurface, border: `1px solid ${T.border}`,
                cursor: item.target_id ? 'pointer' : 'default',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 8, background: '#111', color: '#fff',
                  fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  P{item.priority}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text, flex: 1 }}>{item.action}</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, color: IMPACT_COLOR[item.impact] ?? T.textDim,
                  letterSpacing: '0.06em',
                }}>
                  {item.impact.toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: 11, color: T.textMuted, margin: '0 0 6px', lineHeight: 1.5 }}>{item.why}</p>
              <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono }}>{item.effort}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HealthRing({ score, color, label }: { score: number; color: string; label: string }) {
  const SIZE = 72, STROKE = 6, R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dash = (score / 100) * CIRC;

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={T.border} strokeWidth={STROKE} />
        <circle
          cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={color} strokeWidth={STROKE}
          strokeDasharray={`${dash} ${CIRC}`} strokeLinecap="round"
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color: T.textDim, letterSpacing: '0.06em' }}>{label.slice(0, 4).toUpperCase()}</span>
      </div>
    </div>
  );
}

function MetricChip({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 12, background: T.bgSurface,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: T.textDim, letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 9, color: T.textDim, marginTop: 2 }}>{hint}</div>
    </div>
  );
}
