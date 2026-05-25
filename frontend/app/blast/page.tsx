'use client';

/**
 * app/blast/page.tsx
 *
 * Shareable, standalone blast radius page.
 * URL format: /blast?repo=owner/repo&file=path/to/file.ts&score=72&label=High
 *
 * When loaded:
 *   1. Reads query params for instant preview (score + label shown immediately)
 *   2. Calls /analyze then /blast-radius for full data
 *   3. Renders full ring visualization
 *
 * This page has zero auth. Works for any public repo.
 * It's designed to be shared in Slack, PR comments, tweets.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

// ─── Minimal inline styles (no theme import needed — standalone page) ─────────

const S = {
  bg:        '#0a0a0a',
  surface:   '#111111',
  border:    '#1f1f1f',
  borderMid: '#2a2a2a',
  text:      '#f0f0f0',
  textMuted: '#6b7280',
  textDim:   '#4b5563',
  mono:      'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  sans:      '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
};

const RING_COLORS = [
  { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',   text: '#ef4444' },
  { bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.25)',  text: '#f97316' },
  { bg: 'rgba(234,179,8,0.08)',   border: 'rgba(234,179,8,0.25)',   text: '#eab308' },
  { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.25)',   text: '#22c55e' },
  { bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.25)',  text: '#3b82f6' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RingFile {
  id: string; name: string; path: string;
  role: string; is_hub: boolean; is_entry: boolean; is_test: boolean;
}
interface Ring { depth: number; files: RingFile[]; file_count: number; }
interface BlastResult {
  node: string; node_name: string;
  total_affected: number; actual_depth: number;
  rings: Ring[];
  risk_score: number; risk_label: string; risk_color: string;
  risk_breakdown: { width: number; depth: number; hubs: number; tests: number; entry: number };
  hub_files: string[]; entry_files: string[];
  summary: string;
}

// ─── Risk arc ─────────────────────────────────────────────────────────────────

function RiskArc({ score, color, label }: { score: number; color: string; label: string }) {
  const [anim, setAnim] = useState(0);
  const SIZE = 140, STROKE = 12, R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R, SWEEP = 240;
  const offset = CIRC - (anim / 100) * (CIRC * SWEEP / 360);

  useEffect(() => { const t = setTimeout(() => setAnim(score), 100); return () => clearTimeout(t); }, [score]);

  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} style={{ transform: 'rotate(150deg)' }}>
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={S.border} strokeWidth={STROKE}
          strokeDasharray={`${CIRC*SWEEP/360} ${CIRC}`} strokeLinecap="round" />
        <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={color} strokeWidth={STROKE}
          strokeDasharray={`${CIRC*SWEEP/360} ${CIRC}`} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16,1,0.3,1)' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transform: 'translateY(-8px)',
      }}>
        <span style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em' }}>{anim}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: S.textMuted, letterSpacing: '0.08em', marginTop: 4 }}>
          {label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BlastPage() {
  const params  = useSearchParams();
  const repo    = params.get('repo') ?? '';
  const file    = params.get('file') ?? '';
  const initScore = parseInt(params.get('score') ?? '0', 10);
  const initLabel = params.get('label') ?? '';

  const [status,  setStatus]  = useState<'preview' | 'loading' | 'done' | 'error'>('preview');
  const [result,  setResult]  = useState<BlastResult | null>(null);
  const [copied,  setCopied]  = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // Determine risk color from label
  const labelColor = (label: string) =>
    label === 'Critical' ? '#ef4444'
    : label === 'High'   ? '#f97316'
    : label === 'Medium' ? '#eab308'
    : '#22c55e';

  const loadFull = useCallback(async () => {
    if (!repo || !file) return;
    setStatus('loading');

    try {
      // Step 1: ensure repo is analyzed (cache hit is instant)
      const analyzeRes = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repo }),
      });
      if (!analyzeRes.ok) throw new Error('Analyze failed');
      const analyzeData = await analyzeRes.json();

      // Step 2: blast share
      const blastRes = await fetch(`${API}/blast-share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: repo, file_path: file, depth: 5 }),
      });
      if (!blastRes.ok) throw new Error('Blast failed');
      const blastData: BlastResult = await blastRes.json();
      setResult(blastData);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [repo, file, API]);

  useEffect(() => { loadFull(); }, [loadFull]);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const fileName = file.split('/').pop() ?? file;
  const riskColor = result ? result.risk_color : labelColor(initLabel);
  const riskScore = result ? result.risk_score : initScore;
  const riskLabel = result ? result.risk_label : initLabel;

  return (
    <div style={{
      minHeight: '100vh', background: S.bg, color: S.text,
      fontFamily: S.sans, padding: '32px 20px',
    }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ── Logo strip ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <a href="/" style={{
            display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'linear-gradient(135deg, #ef4444, #f97316)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, color: '#fff', fontSize: 14,
            }}>R</div>
            <span style={{ fontSize: 15, fontWeight: 700, color: S.text }}>Repogami</span>
          </a>
          <span style={{ fontSize: 13, color: S.textDim, marginLeft: 4 }}>/ Blast Radius</span>
        </div>

        {/* ── File header ────────────────────────────────────────────── */}
        <div style={{
          padding: '24px', borderRadius: 16,
          background: S.surface, border: `1px solid ${S.border}`,
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <RiskArc score={riskScore} color={riskColor} label={riskLabel} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: S.textDim, letterSpacing: '0.08em', marginBottom: 8 }}>
                BLAST RADIUS ANALYSIS
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: S.text, lineHeight: 1.2, marginBottom: 6, wordBreak: 'break-all' }}>
                {fileName}
              </div>
              <div style={{ fontSize: 12, color: S.textMuted, fontFamily: S.mono, marginBottom: 16, wordBreak: 'break-all' }}>
                {file}
              </div>
              <a
                href={`https://github.com/${repo}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 12, color: S.textMuted, textDecoration: 'none',
                  padding: '6px 12px', borderRadius: 100,
                  background: S.bg, border: `1px solid ${S.border}`,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                {repo}
              </a>
            </div>
          </div>

          {/* Status */}
          {status === 'loading' && (
            <div style={{
              marginTop: 20, padding: '12px 16px', borderRadius: 10,
              background: S.bg, border: `1px solid ${S.border}`,
              fontSize: 13, color: S.textMuted, display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: `2px solid ${S.border}`, borderTopColor: riskColor,
                animation: 'spin 0.8s linear infinite',
              }} />
              Loading full analysis…
            </div>
          )}
        </div>

        {/* ── Full results ────────────────────────────────────────────── */}
        {result && status === 'done' && (
          <>
            {/* Stats row */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24,
            }}>
              {[
                { label: 'Files Affected', value: result.total_affected },
                { label: 'Layers Deep',    value: result.actual_depth   },
                { label: 'Hub Files',      value: result.hub_files.length },
              ].map(m => (
                <div key={m.label} style={{
                  padding: '16px', borderRadius: 14,
                  background: S.surface, border: `1px solid ${S.border}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: S.text, letterSpacing: '-0.03em' }}>
                    {m.value}
                  </div>
                  <div style={{ fontSize: 11, color: S.textMuted, fontWeight: 600, marginTop: 4, letterSpacing: '0.04em' }}>
                    {m.label.toUpperCase()}
                  </div>
                </div>
              ))}
            </div>

            {/* Warning */}
            {(result.hub_files.length > 0 || result.entry_files.length > 0) && (
              <div style={{
                padding: '14px 16px', borderRadius: 12, marginBottom: 20,
                background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 13, color: S.text, lineHeight: 1.6,
              }}>
                ⚠️{' '}
                {result.hub_files.length > 0 && <span><strong>{result.hub_files.length} hub file{result.hub_files.length !== 1 ? 's' : ''}</strong> in blast radius. </span>}
                {result.entry_files.length > 0 && <span><strong>{result.entry_files.length} entry point{result.entry_files.length !== 1 ? 's' : ''}</strong> exposed.</span>}
              </div>
            )}

            {/* Rings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
              {/* Origin */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px', borderRadius: 14,
                background: `${riskColor}12`, border: `1.5px solid ${riskColor}35`,
              }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: riskColor, flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: S.text, wordBreak: 'break-all' }}>{fileName}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: riskColor, letterSpacing: '0.06em' }}>ORIGIN</span>
              </div>

              <div style={{ width: 1, height: 10, background: S.border, marginLeft: 22 }} />

              {result.rings.map((ring, i) => {
                const rc = RING_COLORS[i] ?? RING_COLORS[RING_COLORS.length - 1];
                return (
                  <React.Fragment key={ring.depth}>
                    <div style={{ borderRadius: 14, border: `1px solid ${rc.border}`, background: rc.bg, overflow: 'hidden' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '12px 16px', borderBottom: ring.files.length > 0 ? `1px solid ${rc.border}` : 'none',
                      }}>
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', background: rc.text,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>{ring.depth}</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: rc.text }}>Layer {ring.depth}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: S.textMuted, fontWeight: 600 }}>
                          {ring.file_count} file{ring.file_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {ring.files.length > 0 && (
                        <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {ring.files.map(f => (
                            <span key={f.id} title={f.path} style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '5px 10px', borderRadius: 100,
                              background: 'rgba(255,255,255,0.04)', border: `1px solid ${S.border}`,
                              fontSize: 11, fontWeight: 600, color: S.text,
                            }}>
                              {f.is_hub   && <span style={{ color: '#8b5cf6', fontSize: 9 }}>HUB </span>}
                              {f.is_entry && <span style={{ color: '#3b82f6', fontSize: 9 }}>ENTRY </span>}
                              {f.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {i < result.rings.length - 1 && (
                      <div style={{ width: 1, height: 8, background: S.border, marginLeft: 22 }} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Summary */}
            <div style={{
              padding: '14px 16px', borderRadius: 12, marginBottom: 24,
              background: S.surface, border: `1px solid ${S.border}`,
              fontSize: 12, color: S.textMuted, fontFamily: S.mono, lineHeight: 1.6,
            }}>
              {result.summary}
            </div>
          </>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={handleCopy}
            style={{
              flex: 1, minWidth: 140, height: 44, borderRadius: 100,
              background: copied ? '#22c55e' : '#111',
              color: '#fff', border: `1px solid ${S.border}`,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.2s ease',
            }}
          >
            {copied ? '✓ Copied!' : '⎘ Copy Link'}
          </button>
          <a
            href={`/?url=${encodeURIComponent(repo)}`}
            style={{
              flex: 1, minWidth: 140, height: 44, borderRadius: 100,
              background: 'transparent', color: S.textMuted,
              border: `1px solid ${S.border}`,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textDecoration: 'none', transition: 'all 0.2s ease',
            }}
          >
            Open in Repogami →
          </a>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, textAlign: 'center', fontSize: 12, color: S.textDim }}>
          Generated by{' '}
          <a href="/" style={{ color: S.textMuted, textDecoration: 'none', fontWeight: 600 }}>Repogami</a>
          {' '}· Free forever · No login required
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}