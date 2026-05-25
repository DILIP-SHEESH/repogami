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
    .replace(/repogami\.dev\/dna\?repo=[^\s]+/, dnaUrl.replace(/^https?:\/\//, ''))
    .replace(/→ \/dna\?repo=/, `→ ${dnaUrl.replace(/^https?:\/\//, '')}`);
  const tweetWithLink = tweet.includes(dnaUrl) || tweet.includes('/dna?repo=')
    ? tweet
    : `${tweet}\n\n${dnaUrl}`;

  const copy = useCallback(async (kind: 'tweet' | 'link') => {
    const text = kind === 'tweet' ? tweetWithLink : dnaUrl;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2200);
    } catch { /* ignore */ }
  }, [tweetWithLink, dnaUrl]);

  return (
    <div style={{
      marginBottom: 20, padding: 16, borderRadius: 16,
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      border: '1px solid #2a2a3a', color: '#f0f0f0',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', color: '#888',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <i className="ti ti-share-2" style={{ fontSize: 14 }} />
        SHARE PACK — POST THIS
      </div>

      <div style={{ fontSize: 28, marginBottom: 8 }}>{dna.personality.emoji}</div>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.02em' }}>
        {dna.personality.type}
      </div>
      <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.55, margin: '0 0 12px' }}>
        {dna.viral_headline}
      </p>
      <p style={{
        fontSize: 11, color: '#666', fontFamily: T.mono, margin: '0 0 16px',
        padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 10,
        lineHeight: 1.5, whiteSpace: 'pre-wrap',
      }}>
        {tweetWithLink}
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => copy('tweet')}
          style={shareBtnStyle(copied === 'tweet')}
        >
          {copied === 'tweet' ? '✓ Copied tweet' : 'Copy for X / LinkedIn'}
        </button>
        <button
          type="button"
          onClick={() => copy('link')}
          style={shareBtnStyle(copied === 'link')}
        >
          {copied === 'link' ? '✓ Copied link' : 'Copy DNA link'}
        </button>
        <a
          href={dnaUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...shareBtnStyle(false),
            textDecoration: 'none',
            background: 'transparent',
            border: '1px solid #444',
            color: '#ccc',
          }}
        >
          Open card →
        </a>
      </div>
    </div>
  );
}

function shareBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1, minWidth: 120, height: 40, borderRadius: 100, border: 'none',
    background: active ? '#22c55e' : '#fff',
    color: active ? '#fff' : '#111',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: T.sans,
  };
}
