import React from 'react';
import { T, ROLES } from '../../theme';
import { GNode } from '../../types';

interface AskPanelProps {
  selectedNode: GNode | null;
  aiQuestion: string;
  setAiQuestion: (q: string) => void;
  handleAsk: () => void;
  aiLoading: boolean;
  aiAnswer: string;
}

export default function AskPanel({ selectedNode, aiQuestion, setAiQuestion, handleAsk, aiLoading, aiAnswer }: AskPanelProps) {
  if (!selectedNode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: T.bgSurface,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
        }}>
          <i className="ti ti-message-circle-code" style={{ fontSize: 20, color: T.textDim }} />
        </div>
        <div style={{ fontSize: 12.5, color: T.textMuted, lineHeight: 1.6, textAlign: 'center' }}>
          Select a node first<br/>to establish AI context
        </div>
      </div>
    );
  }

  const roleDef = ROLES[selectedNode.role] ?? ROLES.default;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16, gap: 12, overflow: 'hidden' }}>

      {/* Context pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 10px', background: T.bgSurface,
        border: `1px solid ${T.border}`, borderRadius: 8, flexShrink: 0,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: roleDef.color, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNode.path}
        </span>
        <span style={{
          fontSize: 9.5, fontFamily: T.mono, color: roleDef.color,
          background: `${roleDef.color}18`, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
        }}>
          {roleDef.label}
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={aiQuestion}
        onChange={e => setAiQuestion(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAsk(); }}
        placeholder={`What does ${selectedNode.name} do?\nWhat breaks if I delete this?\n\n↵ Ctrl/⌘ + Enter to send`}
        rows={5}
        style={{
          background: T.bgSurface, border: `1px solid ${T.border}`, color: T.text,
          padding: '12px 14px', borderRadius: 8, fontFamily: T.sans, fontSize: 13,
          resize: 'none', outline: 'none', lineHeight: 1.6,
          transition: 'border-color 0.15s',
          flexShrink: 0,
        }}
        onFocus={e => { e.target.style.borderColor = T.borderHi; }}
        onBlur={e => { e.target.style.borderColor = T.border; }}
      />

      {/* Send button */}
      <button
        onClick={() => handleAsk()}
        disabled={aiLoading || !aiQuestion.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '10px', borderRadius: 8, border: 'none',
          background: aiLoading || !aiQuestion.trim() ? T.bgSurface : T.text,
          color: aiLoading || !aiQuestion.trim() ? T.textDim : T.bgElevated,
          fontFamily: T.mono, fontWeight: 500, fontSize: 12,
          cursor: aiLoading || !aiQuestion.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s', flexShrink: 0,
        }}
      >
        {aiLoading
          ? <><i className="ti ti-loader-2" style={{ fontSize: 13, animation: 'spin 0.8s linear infinite' }} /> Thinking…</>
          : <><i className="ti ti-send" style={{ fontSize: 13 }} /> Send query</>
        }
      </button>

      {/* Answer */}
      {aiAnswer && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            fontSize: 10, fontFamily: T.mono, color: T.textDim,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, flexShrink: 0,
          }}>
            Response
          </div>
          <div style={{
            flex: 1, overflowY: 'auto',
            background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '14px 16px', fontSize: 13, color: T.textMuted,
            lineHeight: 1.75, whiteSpace: 'pre-wrap', fontFamily: T.sans,
          }}>
            {aiAnswer}
          </div>
        </div>
      )}
    </div>
  );
}