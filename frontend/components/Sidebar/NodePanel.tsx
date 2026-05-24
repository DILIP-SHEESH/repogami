import React from 'react';
import { T, ROLES } from '../../theme';
import { GNode, AnalyzeResult } from '../../types';

interface NodePanelProps {
  selectedNode: GNode | null;
  data: AnalyzeResult | null;
  handleNodeClick: (node: GNode) => void;
  runBlast: () => void;
  blastLoading: boolean;
  handleAsk: (q: string) => void;
}

export default function NodePanel({ selectedNode, data, handleNodeClick, runBlast, blastLoading, handleAsk }: NodePanelProps) {
  if (!selectedNode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, paddingTop: 48 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, background: T.bgSurface,
            border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <i className="ti ti-click" style={{ fontSize: 20, color: T.textDim }} />
          </div>
          <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6 }}>
            Click any node<br/>to inspect its footprint
          </div>
        </div>

        {data && data.stats.top_hubs.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textDim, letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
              Core Hubs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {data.stats.top_hubs.slice(0, 6).map(h => {
                const node = data.graph.nodes.find(x => x.id === h.id);
                const roleDef = ROLES[node?.role ?? 'default'] ?? ROLES.default;
                return (
                  <div
                    key={h.id}
                    className="hub-row"
                    onClick={() => { if (node) handleNodeClick(node); }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: roleDef.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, fontFamily: T.mono, color: T.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: T.cyan, fontFamily: T.mono }}>↑{h.indegree}</span>
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

  const roleDef = ROLES[selectedNode.role] ?? ROLES.default;

  return (
    <div style={{ flex: 1, padding: '16px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Role badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px 3px 8px', borderRadius: 999, marginBottom: 14,
        background: `${roleDef.color}18`, border: `1px solid ${roleDef.color}30`,
        color: roleDef.color, fontSize: 10.5, fontFamily: T.mono, fontWeight: 500,
        alignSelf: 'flex-start',
      }}>
        <i className={`ti ${roleDef.glyph}`} style={{ fontSize: 11 }} />
        {roleDef.label}
      </div>

      {/* File name */}
      <div style={{
        fontSize: 14, fontWeight: 600, color: T.text,
        marginBottom: 4, wordBreak: 'break-all', lineHeight: 1.3,
      }}>
        {selectedNode.name}
      </div>

      {/* Path */}
      <div style={{
        fontSize: 10.5, fontFamily: T.mono, color: T.textDim,
        marginBottom: 18, wordBreak: 'break-all', lineHeight: 1.5,
      }}>
        {selectedNode.path}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 12, color: T.textMuted, lineHeight: 1.6,
        padding: '10px 12px', background: T.bgSurface,
        border: `1px solid ${T.border}`, borderRadius: 8,
        marginBottom: 16,
      }}>
        {roleDef.desc}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
        {selectedNode.is_hub   && <Tag icon="ti-antenna"          color={T.amber}  label="Hub" />}
        {selectedNode.is_entry && <Tag icon="ti-triangle-inverted" color={T.green}  label="Entry point" />}
        {selectedNode.is_orphan&& <Tag icon="ti-unlink"           color={T.red}    label="Orphan" />}
        {selectedNode.is_config&& <Tag icon="ti-settings-2"       color={T.textDim} label="Config" />}
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
        <Metric label="Imported by" value={selectedNode.indegree}  color={T.cyan} />
        <Metric label="Imports"     value={selectedNode.outdegree} color={T.purple} />
        <Metric label="Role"        value={roleDef.label.slice(0,4)} color={roleDef.color} />
      </div>

      {/* Blast radius button */}
      <button
        onClick={runBlast}
        disabled={blastLoading}
        className="rg-btn"
        style={{ width: '100%', marginBottom: 20, justifyContent: 'center', gap: 7 }}
      >
        {blastLoading
          ? <><i className="ti ti-loader-2" style={{ fontSize: 13, animation: 'spin 0.8s linear infinite' }} /> Calculating…</>
          : <><i className="ti ti-ripple" style={{ fontSize: 13 }} /> Blast radius</>
        }
      </button>

      {/* Divider */}
      <div style={{ height: 1, background: T.border, marginBottom: 14 }} />

      {/* Quick prompts */}
      <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textDim, letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
        Ask AI
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {([
          selectedNode.is_orphan ? `Is ${selectedNode.name} safe to delete?` : null,
          selectedNode.is_hub    ? `What breaks if ${selectedNode.name} changes?` : null,
          `Explain what ${selectedNode.name} does`,
          selectedNode.indegree > 3 ? `Why is ${selectedNode.name} imported so much?` : null,
          `Summarize the role of ${selectedNode.name} in the codebase`,
        ] as (string | null)[]).filter(Boolean).map(q => (
          <button
            key={q!}
            onClick={() => handleAsk(q!)}
            style={{
              textAlign: 'left', background: T.bgSurface, border: `1px solid ${T.border}`,
              color: T.textMuted, padding: '9px 12px', borderRadius: 7,
              fontFamily: T.sans, fontSize: 12, cursor: 'pointer',
              transition: 'all 0.12s', display: 'flex', alignItems: 'flex-start', gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.bgHover; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = T.bgSurface; }}
          >
            <i className="ti ti-arrow-right" style={{ fontSize: 11, color: T.textDim, marginTop: 1, flexShrink: 0 }} />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.border}`,
      borderRadius: 8, padding: '10px 10px 8px',
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color, fontFamily: T.mono, lineHeight: 1, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 9.5, fontFamily: T.mono, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </div>
  );
}

function Tag({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 4,
      background: `${color}14`, border: `1px solid ${color}28`,
      fontSize: 10.5, fontFamily: T.mono, color,
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 10 }} />
      {label}
    </span>
  );
}