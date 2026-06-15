'use client';

import React, { useState, useCallback } from 'react';
import { T } from '../../theme';
import { AnalyzeResult } from '../../types';

interface SharePackProps {
  data: AnalyzeResult;
  analyzedUrl: string;
}

export default function SharePack({ data, analyzedUrl }: SharePackProps) {
  const [copied, setCopied] = useState<'tweet' | 'link' | null>(null);
  const dna = data.repo_dna;
  if (!dna) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const repoSlug = `${data.meta.owner}/${data.meta.repo}`;
  const dnaUrl = `${origin}/dna?repo=${encodeURIComponent(repoSlug)}`;

  const tweet = dna.share_tweet
    .replace(/https?:\/\/[^\s]+\/dna\?repo=[^\s]+/g, dnaUrl)
    .replace(/\/dna\?repo=[^\s]+/g, dnaUrl)
    .replace(/→ /g, '');

  const tweetWithLink = tweet.includes(dnaUrl)
    ? tweet
    : `${tweet}\n\n${dnaUrl}`;

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const copy = useCallback(async (kind: 'tweet' | 'link') => {
    const text = kind === 'tweet' ? tweetWithLink : dnaUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2200);
      fetch(`${API}/track`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'shares', label: `${kind}_${repoSlug}`, repo: repoSlug }),
      }).catch(() => {});
    } catch { /* ignore */ }
  }, [tweetWithLink, dnaUrl, repoSlug]);

  return (
    <div style={{
      marginBottom: 20, padding: 16, borderRadius: 16,
      background: T.bgSurface, border: `1px solid ${T.border}`,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: T.textDim,
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <i className="ti ti-share-2" style={{ fontSize: 14 }} />
        SHARE PACK
      </div>

      <div style={{ fontSize: 28, marginBottom: 8 }}>{dna.personality.emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em', color: T.text }}>
        {dna.personality.type}
      </div>
      <p style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.55, margin: '0 0 12px' }}>
        {dna.viral_headline}
      </p>
      <p style={{
        fontSize: 11, color: T.textDim, fontFamily: T.mono, margin: '0 0 16px',
        padding: '10px 12px', background: T.bgHover, borderRadius: 10,
        lineHeight: 1.5, whiteSpace: 'pre-wrap', border: `1px solid ${T.border}`,
      }}>
        {tweetWithLink}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => copy('tweet')}
          style={shareBtnStyle(copied === 'tweet')}
        >
          {copied === 'tweet' ? '✓ Copied' : 'Copy for X / LinkedIn'}
        </button>
        <button
          type="button"
          onClick={() => copy('link')}
          style={shareBtnStyle(copied === 'link')}
        >
          {copied === 'link' ? '✓ Copied' : 'Copy DNA link'}
        </button>
        <a
          href={dnaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...shareBtnStyle(false),
            textDecoration: 'none',
            background: 'transparent',
            border: `1px solid ${T.border}`,
            color: T.textDim,
          }}
        >
          Open →
        </a>
      </div>
    </div>
  );
}

function shareBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, minWidth: 120, height: 40, borderRadius: 100, border: 'none',
    background: active ? '#22c55e' : '#111',
    color: active ? '#fff' : '#fff',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: T.sans,
  };
}
