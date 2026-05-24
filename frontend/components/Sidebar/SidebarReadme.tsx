'use client';

import React, { useState, useCallback } from 'react';
import { T } from '../../theme';

interface Props {
  readme: string;
  readmeLoading: boolean;
  onGenerate: () => void;
}

export default function SidebarReadme({ readme, readmeLoading, onGenerate }: Props) {
  const [copied, setCopied]   = useState(false);
  const [view, setView]       = useState<'preview' | 'raw'>('preview');

  const handleCopy = useCallback(() => {
    if (!readme) return;
    navigator.clipboard.writeText(readme).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [readme]);

  const handleDownload = useCallback(() => {
    if (!readme) return;
    const blob = new Blob([readme], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
      href: url, download: 'README.md',
    }).click();
    URL.revokeObjectURL(url);
  }, [readme]);

  const renderMarkdown = (md: string): string => {
    let html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre class="rg-code-block" data-lang="${lang}"><code>${code.trimEnd()}</code></pre>`
      )
      .replace(/`([^`]+)`/g, '<code class="rg-inline-code">$1</code>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="height:20px;vertical-align:middle;margin:2px 2px;" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="rg-md-link" target="_blank" rel="noreferrer">$1</a>')
      .replace(/^#### (.+)$/gm, '<h4 class="rg-md-h4">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="rg-md-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="rg-md-h2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="rg-md-h1">$1</h1>')
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^---$/gm, '<hr class="rg-md-hr" />')
      .replace(/^> (.+)$/gm, '<blockquote class="rg-md-bq">$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li class="rg-md-li">$1</li>')
      .replace(/(<li[\s\S]*?<\/li>)(\s*(?!<li))/g, '<ul class="rg-md-ul">$1</ul>$2')
      .replace(/^\|(.+)\|$/gm, (line) => {
        const isSep = /^\|[\s:-]+\|/.test(line);
        if (isSep) return '';
        const cells = line.slice(1, -1).split('|').map(c => c.trim());
        const tag = 'td';
        return `<tr>${cells.map(c => `<${tag} class="rg-md-td">${c}</${tag}>`).join('')}</tr>`;
      })
      .replace(/(<td>[\s\S]*?<\/tr>)/g, '<table class="rg-md-table"><tbody>$1</tbody></table>')
      .replace(/\n\n(?!<)/g, '</p><p class="rg-md-p">')
      .replace(/\n(?!<)/g, '<br/>');

    return `<p class="rg-md-p">${html}</p>`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .rg-md-h1 { font-size: 20px; font-weight: 800; color: ${T.text}; margin: 24px 0 12px; letter-spacing: -0.02em; font-family: ${T.sans}; }
        .rg-md-h2 { font-size: 16px; font-weight: 700; color: ${T.text}; margin: 24px 0 8px; letter-spacing: -0.01em; font-family: ${T.sans}; border-bottom: 1px solid ${T.border}; padding-bottom: 8px; }
        .rg-md-h3 { font-size: 14px; font-weight: 700; color: ${T.textMuted}; margin: 16px 0 6px; font-family: ${T.sans}; }
        .rg-md-h4 { font-size: 13px; font-weight: 600; color: ${T.textMuted}; margin: 12px 0 4px; font-family: ${T.sans}; }
        .rg-md-p  { font-size: 13.5px; color: ${T.textMuted}; line-height: 1.7; margin: 0 0 16px; font-family: ${T.sans}; }
        .rg-md-li { font-size: 13.5px; color: ${T.textMuted}; line-height: 1.65; margin-bottom: 6px; font-family: ${T.sans}; }
        .rg-md-ul { padding-left: 20px; margin: 8px 0 16px; list-style: disc; }
        .rg-md-link { color: ${T.text}; text-decoration: underline; font-weight: 600; transition: color 0.15s; }
        .rg-md-link:hover { color: ${T.textMuted}; }
        .rg-md-hr { border: none; border-top: 1px solid ${T.border}; margin: 24px 0; }
        .rg-md-bq { border-left: 3px solid #111; margin: 16px 0; padding: 8px 16px; color: ${T.textMuted}; font-style: italic; font-size: 13px; background: ${T.bgHover}; border-radius: 0 8px 8px 0; }
        .rg-code-block {
          background: ${T.bgSurface}; border: 1px solid ${T.border}; border-radius: 12px;
          padding: 16px; margin: 16px 0; overflow-x: auto;
          font-family: ${T.mono}; font-size: 12.5px; color: ${T.text}; line-height: 1.6;
          position: relative; box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .rg-code-block::before {
          content: attr(data-lang);
          position: absolute; top: 8px; right: 12px;
          font-size: 10px; color: ${T.textDim}; font-family: ${T.sans}; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.05em;
        }
        .rg-inline-code {
          background: ${T.bgHover}; border: 1px solid ${T.border};
          border-radius: 6px; padding: 2px 6px;
          font-family: ${T.mono}; font-size: 12px; color: ${T.text}; font-weight: 600;
        }
        .rg-md-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; border-radius: 8px; overflow: hidden; border: 1px solid ${T.border}; }
        .rg-md-td { padding: 10px 14px; border-bottom: 1px solid ${T.border}; color: ${T.textMuted}; font-family: ${T.sans}; }
        .rg-md-td:first-child { color: ${T.text}; font-weight: 600; background: ${T.bgHover}; border-right: 1px solid ${T.border}; }
      `}</style>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', borderBottom: `1px solid ${T.border}`,
        flexShrink: 0, background: T.bgElevated, zIndex: 5
      }}>
        {/* View toggle */}
        <div style={{
          display: 'flex', background: T.bgSurface,
          border: `1px solid ${T.border}`, borderRadius: 8, padding: 4, gap: 4,
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          {(['preview', 'raw'] as const).map(v => (
            <button
              key={v} onClick={() => setView(v)}
              style={{
                height: 28, padding: '0 12px', borderRadius: 6, border: 'none',
                background: view === v ? T.bgHover : 'transparent',
                color: view === v ? T.text : T.textDim,
                fontFamily: T.sans, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', textTransform: 'capitalize'
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Copy / DL */}
        {readme && (
          <>
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`,
                background: copied ? T.text : T.bgSurface, color: copied ? '#fff' : T.text,
                fontFamily: T.sans, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={e => { if(!copied) e.currentTarget.style.background = T.bgHover; }}
              onMouseLeave={e => { if(!copied) e.currentTarget.style.background = T.bgSurface; }}
            >
              <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ fontSize: 14 }} />
              {copied ? 'Copied' : 'Copy'}
            </button>

            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 32, padding: '0 12px', borderRadius: 8, border: `1px solid ${T.border}`,
                background: T.bgSurface, color: T.text,
                fontFamily: T.sans, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
              onMouseLeave={e => e.currentTarget.style.background = T.bgSurface}
            >
              <i className="ti ti-download" style={{ fontSize: 14 }} />
              MD
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        {!readme && !readmeLoading && (
          <div style={{ textAlign: 'center', paddingTop: 64 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: T.bgSurface, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <i className="ti ti-file-description" style={{ fontSize: 28, color: T.text }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 12, letterSpacing: '-0.02em' }}>
              No README generated
            </div>
            <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
              Generate a developer-grade README with badges, architecture summary, and setup instructions.
            </div>
            <button
              onClick={onGenerate}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, height: 48, padding: '0 24px',
                borderRadius: 100, border: 'none', background: '#111', color: '#fff',
                fontFamily: T.sans, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
            >
              <i className="ti ti-sparkles" style={{ fontSize: 16 }} />
              Generate README.md
            </button>
          </div>
        )}

        {readmeLoading && (
          <div style={{ textAlign: 'center', paddingTop: 64 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, background: T.bgSurface, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
            }}>
              <i className="ti ti-loader-2" style={{ fontSize: 28, color: T.text, animation: 'spin 0.6s linear infinite' }} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>
              Writing documentation…
            </div>
            <div style={{ fontSize: 13, color: T.textDim, marginTop: 8, fontFamily: T.sans, fontWeight: 500 }}>
              analysing modules · writing sections · adding badges
            </div>
          </div>
        )}

        {readme && !readmeLoading && (
          view === 'raw' ? (
            <pre style={{
              fontFamily: T.mono, fontSize: 13, color: T.textMuted, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0, padding: '20px', background: T.bgSurface, borderRadius: 16, border: `1px solid ${T.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              {readme}
            </pre>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(readme) }} style={{ minHeight: 100 }} />
          )
        )}
      </div>

      {/* Regenerate footer */}
      {readme && !readmeLoading && (
        <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, background: T.bgElevated }}>
          <span style={{ fontSize: 12, color: T.textDim, fontFamily: T.sans, fontWeight: 600, flex: 1 }}>
            README.md · {readme.split('\n').length} lines
          </span>
          <button
            onClick={onGenerate}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, height: 36, padding: '0 16px', borderRadius: 100, border: `1px solid ${T.border}`,
              background: T.bgSurface, color: T.text, fontFamily: T.sans, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bgHover; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = T.bgSurface; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <i className="ti ti-refresh" style={{ fontSize: 14 }} />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}