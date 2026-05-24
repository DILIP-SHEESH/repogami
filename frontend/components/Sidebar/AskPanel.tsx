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
          width: 48, height: 48, borderRadius: 12, background: T.bgSurface,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <i className="ti ti-message-circle-code" style={{ fontSize: 24, color: T.textDim }} />
        </div>
        <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, textAlign: 'center', fontWeight: 500 }}>
          Select a node first<br/>to establish AI context
        </div>
      </div>
    );
  }

  const roleDef = ROLES[selectedNode.role] ?? ROLES.default;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 16, overflow: 'hidden' }}>

      {/* Context pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: T.bgSurface,
        border: `1px solid ${T.border}`, borderRadius: 12, flexShrink: 0,
        boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: roleDef.color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontFamily: T.sans, fontWeight: 500, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNode.path}
        </span>
        <span style={{
          fontSize: 10, fontFamily: T.sans, fontWeight: 600, color: roleDef.color,
          background: T.bgHover, border: `1px solid ${T.border}`, padding: '3px 8px', borderRadius: 100, flexShrink: 0,
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
          padding: '16px', borderRadius: 12, fontFamily: T.sans, fontSize: 14,
          resize: 'none', outline: 'none', lineHeight: 1.6,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          flexShrink: 0,
        }}
        onFocus={e => { e.target.style.borderColor = T.borderHi; e.target.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.03)'; }}
        onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = 'none'; }}
      />

      {/* Send button */}
      <button
        onClick={() => handleAsk()}
        disabled={aiLoading || !aiQuestion.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '12px', borderRadius: 100, border: 'none',
          background: aiLoading || !aiQuestion.trim() ? T.bgHover : '#111',
          color: aiLoading || !aiQuestion.trim() ? T.textDim : '#fff',
          fontFamily: T.sans, fontWeight: 600, fontSize: 13,
          cursor: aiLoading || !aiQuestion.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s', flexShrink: 0,
        }}
      >
        {aiLoading
          ? <><i className="ti ti-loader-2" style={{ fontSize: 14, animation: 'spin 0.6s linear infinite' }} /> Thinking…</>
          : <><i className="ti ti-send" style={{ fontSize: 14 }} /> Send query</>
        }
      </button>

      {/* Answer */}
      {aiAnswer && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 8 }}>
          <div style={{
            fontSize: 11, fontFamily: T.sans, fontWeight: 600, color: T.textMuted,
            letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, flexShrink: 0,
          }}>
            Response
          </div>
          <div style={{
            flex: 1, overflowY: 'auto',
            background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 12,
            padding: '20px', fontSize: 14, color: T.text,
            lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: T.sans,
          }}>
            {aiAnswer}
          </div>
        </div>
      )}
    </div>
  );
}