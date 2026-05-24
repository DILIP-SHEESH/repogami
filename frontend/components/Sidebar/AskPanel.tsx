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
          width: 56, height: 56, borderRadius: 16, background: T.bgSurface,
          border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
          boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <i className="ti ti-message-circle-code" style={{ fontSize: 28, color: T.text }} />
        </div>
        <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, textAlign: 'center', fontWeight: 500 }}>
          Select a node first<br/>to establish AI context
        </div>
      </div>
    );
  }

  const roleDef = ROLES[selectedNode.role] ?? ROLES.default;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 20, overflow: 'hidden' }}>
      
      {/* Premium Context Pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: T.bgSurface,
        border: `1px solid ${T.border}`, borderRadius: 16, flexShrink: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
      }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: roleDef.color, flexShrink: 0, boxShadow: `0 0 0 2px ${T.bgSurface}, 0 0 0 4px ${roleDef.bg}` }} />
        <span style={{ fontSize: 13, fontFamily: T.sans, fontWeight: 600, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedNode.path}
        </span>
        <span style={{ fontSize: 10, fontFamily: T.sans, fontWeight: 700, color: roleDef.color, background: T.bgHover, padding: '4px 10px', borderRadius: 100, flexShrink: 0 }}>
          {roleDef.label}
        </span>
      </div>

      {/* AI Textarea */}
      <textarea
        value={aiQuestion}
        onChange={e => setAiQuestion(e.target.value)}
        onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAsk(); }}
        placeholder={`What does ${selectedNode.name} do?\nWhat breaks if I delete this?\n\n↵ Ctrl/⌘ + Enter to send`}
        rows={5}
        style={{
          background: T.bgSurface, border: `1px solid ${T.border}`, color: T.text,
          padding: '16px', borderRadius: 16, fontFamily: T.sans, fontSize: 14,
          resize: 'none', outline: 'none', lineHeight: 1.6,
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}
        onFocus={e => { e.target.style.borderColor = '#111'; e.target.style.boxShadow = '0 0 0 4px rgba(17,17,17,0.08)'; }}
        onBlur={e => { e.target.style.borderColor = T.border; e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; }}
      />

      {/* Sleek Send Button */}
      <button
        onClick={() => handleAsk()}
        disabled={aiLoading || !aiQuestion.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48,
          borderRadius: 100, border: 'none',
          background: aiLoading || !aiQuestion.trim() ? T.bgHover : '#111',
          color: aiLoading || !aiQuestion.trim() ? T.textDim : '#fff',
          fontFamily: T.sans, fontWeight: 600, fontSize: 14,
          cursor: aiLoading || !aiQuestion.trim() ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', flexShrink: 0,
          boxShadow: aiLoading || !aiQuestion.trim() ? 'none' : '0 4px 12px rgba(0,0,0,0.1)'
        }}
        onMouseEnter={e => { if(!aiLoading && aiQuestion.trim()) e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { if(!aiLoading && aiQuestion.trim()) e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {aiLoading ? <><i className="ti ti-loader-2" style={{ fontSize: 16, animation: 'spin 0.6s linear infinite' }} /> Thinking…</> : <><i className="ti ti-sparkles" style={{ fontSize: 16 }} /> Ask Repogami</>}
      </button>

      {/* Premium Answer Box */}
      {aiAnswer && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, marginTop: 8, animation: 'fade-up 0.4s ease' }}>
          <div style={{ fontSize: 11, fontFamily: T.sans, fontWeight: 700, color: T.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12, flexShrink: 0 }}>
            Response
          </div>
          <div style={{
            flex: 1, overflowY: 'auto', background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16,
            padding: '24px', fontSize: 14.5, color: T.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: T.sans,
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}>
            {aiAnswer}
          </div>
        </div>
      )}
    </div>
  );
}