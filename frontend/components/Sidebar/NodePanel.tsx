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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 24, paddingTop: 48 }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: T.bgSurface,
            border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
          }}>
            <i className="ti ti-click" style={{ fontSize: 24, color: T.textDim }} />
          </div>
          <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, fontWeight: 500 }}>
            Click any node<br/>to inspect its footprint
          </div>
        </div>

        {data && data.stats.top_hubs.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontFamily: T.sans, fontWeight: 600, color: T.textMuted, letterSpacing: '0.05em', marginBottom: 12, textTransform: 'uppercase' }}>
              Core Hubs
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.stats.top_hubs.slice(0, 6).map(h => {
                const node = data.graph.nodes.find(x => x.id === h.id);
                const roleDef = ROLES[node?.role ?? 'default'] ?? ROLES.default;
                return (
                  <div
                    key={h.id}
                    className="hub-row"
                    onClick={() => { if (node) handleNodeClick(node); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
                      cursor: 'pointer', transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
                    onMouseLeave={e => e.currentTarget.style.background = T.bgSurface}
                  >
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: roleDef.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontFamily: T.sans, fontWeight: 500, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {h.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: T.sans, fontWeight: 600 }}>↑{h.indegree}</span>
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
    <div style={{ flex: 1, padding: '24px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Role badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 100, marginBottom: 16,
        background: T.bgHover, border: `1px solid ${T.border}`,
        color: roleDef.color, fontSize: 11, fontFamily: T.sans, fontWeight: 600,
        alignSelf: 'flex-start',
      }}>
        <i className={`ti ${roleDef.glyph}`} style={{ fontSize: 14 }} />
        {roleDef.label}
      </div>

      {/* File name */}
      <div style={{
        fontSize: 18, fontWeight: 700, color: T.text,
        marginBottom: 6, wordBreak: 'break-all', lineHeight: 1.2, letterSpacing: '-0.01em'
      }}>
        {selectedNode.name}
      </div>

      {/* Path */}
      <div style={{
        fontSize: 12, fontFamily: T.sans, color: T.textDim,
        marginBottom: 24, wordBreak: 'break-all', lineHeight: 1.5,
      }}>
        {selectedNode.path}
      </div>

      {/* Description */}
      <div style={{
        fontSize: 13, color: T.textMuted, lineHeight: 1.6,
        padding: '12px 16px', background: T.bgSurface,
        border: `1px solid ${T.border}`, borderRadius: 12,
        marginBottom: 24,
      }}>
        {roleDef.desc}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {selectedNode.is_hub   && <Tag icon="ti-antenna"          label="Hub" />}
        {selectedNode.is_entry && <Tag icon="ti-triangle-inverted"  label="Entry point" />}
        {selectedNode.is_orphan&& <Tag icon="ti-unlink"           label="Orphan" />}
        {selectedNode.is_config&& <Tag icon="ti-settings-2"       label="Config" />}
      </div>

      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
        <Metric label="Imported by" value={selectedNode.indegree} />
        <Metric label="Imports"     value={selectedNode.outdegree} />
        <Metric label="Role"        value={roleDef.label.slice(0,4)} />
      </div>

      {/* Blast radius button */}
      <button
        onClick={runBlast}
        disabled={blastLoading}
        style={{ 
          width: '100%', marginBottom: 32, justifyContent: 'center', gap: 8,
          background: '#111', color: '#fff', border: 'none', borderRadius: 100,
          padding: '12px', fontSize: 13, fontWeight: 600, cursor: blastLoading ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', transition: 'opacity 0.15s'
        }}
        onMouseEnter={e => { if(!blastLoading) e.currentTarget.style.opacity = '0.85'; }}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {blastLoading
          ? <><i className="ti ti-loader-2" style={{ fontSize: 14, animation: 'spin 0.6s linear infinite' }} /> Calculating…</>
          : <><i className="ti ti-ripple" style={{ fontSize: 14 }} /> Blast radius</>
        }
      </button>

      {/* Divider */}
      <div style={{ height: 1, background: T.border, marginBottom: 24 }} />

      {/* Quick prompts */}
      <div style={{ fontSize: 11, fontFamily: T.sans, fontWeight: 600, color: T.textMuted, letterSpacing: '0.05em', marginBottom: 12, textTransform: 'uppercase' }}>
        Ask AI
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              color: T.textMuted, padding: '12px 16px', borderRadius: 12,
              fontFamily: T.sans, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 10,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderHi; e.currentTarget.style.color = T.text; e.currentTarget.style.background = T.bgHover; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; e.currentTarget.style.background = T.bgSurface; }}
          >
            <i className="ti ti-arrow-right" style={{ fontSize: 14, color: T.textDim, flexShrink: 0 }} />
            <span>{q}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      background: T.bgSurface, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '12px 12px 10px',
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: T.sans, lineHeight: 1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontFamily: T.sans, fontWeight: 600, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

function Tag({ icon, label }: { icon: string; label: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 6,
      background: T.bgHover, border: `1px solid ${T.border}`,
      fontSize: 11, fontFamily: T.sans, fontWeight: 500, color: T.text,
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 12, color: T.textDim }} />
      {label}
    </span>
  );
}