'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { RepoDna, CompassStep, Stats, Summary } from '../../types';

const S = {
  bg: '#0a0a0a',
  surface: '#111111',
  border: '#1f1f1f',
  text: '#f0f0f0',
  textMuted: '#9ca3af',
  textDim: '#6b7280',
  mono: 'ui-monospace, "Cascadia Code", "Fira Code", monospace',
  sans: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
};

interface DnaPayload {
  repo: string;
  project_name: string;
  tagline: string;
  summary: Summary;
  stats: Stats;
  repo_dna: RepoDna;
  contributor_compass: CompassStep[];
  vitals: { health_score: number; health_grade: string; health_color: string };
}

function DnaPageInner() {
  const params = useSearchParams();
  const repo = params.get('repo') ?? '';
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [payload, setPayload] = useState<DnaPayload | null>(null);
  const [copied, setCopied] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  useEffect(() => {
    async function load() {
      if (!repo) { setStatus('error'); return; }
      setStatus('loading');
      try {
        const analyzeRes = await fetch(`${API}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo_url: repo }),
        });
        if (!analyzeRes.ok) throw new Error('analyze failed');
        const a = await analyzeRes.json();
        if (!a.repo_dna) throw new Error('no dna');

        setPayload({
          repo: `${a.meta.owner}/${a.meta.repo}`,
          project_name: a.summary.project_name,
          tagline: a.summary.tagline,
          summary: a.summary,
          stats: a.stats,
          repo_dna: a.repo_dna,
          contributor_compass: a.contributor_compass ?? [],
          vitals: a.vitals,
        });
        setStatus('done');
      } catch {
        setStatus('error');
      }
    }
    load();
  }, [repo, API]);

  useEffect(() => {
    fetch(`${API_TRACK}/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'dna_views', repo }),
    }).catch(() => {});
  }, [repo]);

  const API_TRACK = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const copyTweet = () => {
    if (!payload) return;
    const origin = window.location.origin;
    const tweet = payload.repo_dna.share_tweet.replace(
      /repogami\.dev[^\s]*/,
      `${origin}/dna?repo=${encodeURIComponent(payload.repo)}`.replace(/^https?:\/\//, ''),
    );
    navigator.clipboard.writeText(tweet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
    fetch(`${API_TRACK}/track`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'shares', label: 'dna_tweet', repo: payload.repo }),
    }).catch(() => {});
  };

  const dna = payload?.repo_dna;
  const color = dna?.share_card.color ?? '#3b82f6';

  return (
    <div style={{
      minHeight: '100vh', background: S.bg, color: S.text,
      fontFamily: S.sans, padding: '32px 20px',
    }}>
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, #ef4444, #f97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, color: '#fff', fontSize: 14,
          }}>R</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: S.text }}>Repogami</span>
          <span style={{ fontSize: 13, color: S.textDim }}>/ Repo DNA</span>
        </a>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: 80, color: S.textMuted }}>Sequencing repo DNA…</div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center', padding: 80, color: '#ef4444' }}>
            Could not load DNA. Check the repo URL.
          </div>
        )}

        {payload && dna && status === 'done' && (
          <div style={{
            borderRadius: 24, overflow: 'hidden',
            border: `1px solid ${S.border}`,
            background: 'linear-gradient(160deg, #111 0%, #0d0d14 50%, #1a0a0a 100%)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          }}>
            <div style={{ padding: '32px 28px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{dna.personality.emoji}</div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', color: S.textDim, marginBottom: 8 }}>
                REPO DNA
              </div>
              <h1 style={{
                fontSize: 28, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-0.03em', lineHeight: 1.15,
              }}>
                {payload.project_name}
              </h1>
              <div style={{ fontSize: 14, color: S.textMuted, marginBottom: 20 }}>{payload.repo}</div>

              <div style={{
                display: 'inline-flex', alignItems: 'baseline', gap: 12, marginBottom: 20,
              }}>
                <span style={{ fontSize: 56, fontWeight: 800, color, lineHeight: 1, letterSpacing: '-0.04em' }}>
                  {dna.share_card.health}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color }}>{dna.share_card.grade}</span>
              </div>

              <p style={{
                fontSize: 18, fontWeight: 700, color: S.text, lineHeight: 1.4, margin: '0 0 16px',
                letterSpacing: '-0.02em',
              }}>
                {dna.viral_headline}
              </p>

              <div style={{
                fontSize: 13, fontWeight: 700, color: color, marginBottom: 12,
              }}>
                {dna.personality.type} — {dna.personality.one_liner}
              </div>

              <p style={{ fontSize: 12, color: S.textDim, margin: 0, fontFamily: S.mono }}>
                {dna.share_card.stats_line}
              </p>
            </div>

            {payload.contributor_compass?.length > 0 && (
              <div style={{ padding: '0 28px 24px', borderTop: `1px solid ${S.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: S.textDim, paddingTop: 20, marginBottom: 12 }}>
                  START HERE (5-MIN ONBOARD)
                </div>
                {payload.contributor_compass.slice(0, 5).map(c => (
                  <div key={c.path} style={{
                    display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10,
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6, background: '#fff', color: '#111',
                      fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{c.step}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              padding: '20px 28px 28px', display: 'flex', gap: 10, flexWrap: 'wrap',
              borderTop: `1px solid ${S.border}`,
            }}>
              <button
                type="button"
                onClick={copyTweet}
                style={{
                  flex: 1, minWidth: 140, height: 44, borderRadius: 100, border: 'none',
                  background: copied ? '#22c55e' : '#fff', color: copied ? '#fff' : '#111',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                {copied ? '✓ Copied' : 'Copy for socials'}
              </button>
              <a
                href={`/?url=${encodeURIComponent(payload.repo)}`}
                style={{
                  flex: 1, minWidth: 140, height: 44, borderRadius: 100,
                  border: `1px solid ${S.border}`, background: 'transparent', color: S.text,
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  textDecoration: 'none',
                }}
              >
                Explore graph →
              </a>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: S.textDim }}>
          Paste any public GitHub URL at repogami — free, no login.
        </p>
      </div>
    </div>
  );
}

export default function DnaPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: S.bg }} />}>
      <DnaPageInner />
    </Suspense>
  );
}
