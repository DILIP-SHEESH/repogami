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

  // Very lightweight markdown → HTML for preview
  // (handles headings, bold, italic, code, badges, links, lists, tables)
  const renderMarkdown = (md: string): string => {
    let html = md
      // Escape HTML
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Fenced code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
        `<pre class="rg-code-block" data-lang="${lang}"><code>${code.trimEnd()}</code></pre>`
      )
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="rg-inline-code">$1</code>')
      // Images/badges (render as <img>)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
        '<img src="$2" alt="$1" style="height:20px;vertical-align:middle;margin:2px 2px;" />'
      )
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="rg-md-link" target="_blank" rel="noreferrer">$1</a>')
      // H1-H4
      .replace(/^#### (.+)$/gm, '<h4 class="rg-md-h4">$1</h4>')
      .replace(/^### (.+)$/gm, '<h3 class="rg-md-h3">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="rg-md-h2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="rg-md-h1">$1</h1>')
      // Bold + italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // HR
      .replace(/^---$/gm, '<hr class="rg-md-hr" />')
      // Blockquote
      .replace(/^> (.+)$/gm, '<blockquote class="rg-md-bq">$1</blockquote>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li class="rg-md-li">$1</li>')
      .replace(/(<li[\s\S]*?<\/li>)(\s*(?!<li))/g, '<ul class="rg-md-ul">$1</ul>$2')
      // Tables (basic)
      .replace(/^\|(.+)\|$/gm, (line) => {
        const isSep = /^\|[\s:-]+\|/.test(line);
        if (isSep) return '';
        const cells = line.slice(1, -1).split('|').map(c => c.trim());
        const tag = 'td';
        return `<tr>${cells.map(c => `<${tag} class="rg-md-td">${c}</${tag}>`).join('')}</tr>`;
      })
      .replace(/(<td>[\s\S]*?<\/tr>)/g, '<table class="rg-md-table"><tbody>$1</tbody></table>')
      // Paragraphs (double newline)
      .replace(/\n\n(?!<)/g, '</p><p class="rg-md-p">')
      .replace(/\n(?!<)/g, '<br/>');

    return `<p class="rg-md-p">${html}</p>`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <style>{`
        .rg-md-h1 { font-size: 18px; font-weight: 700; color: ${T.text}; margin: 20px 0 8px; letter-spacing: -0.02em; font-family: ${T.sans}; }
        .rg-md-h2 { font-size: 14px; font-weight: 600; color: ${T.text}; margin: 18px 0 6px; letter-spacing: -0.01em; font-family: ${T.sans}; border-bottom: 1px solid ${T.border}; padding-bottom: 6px; }
        .rg-md-h3 { font-size: 13px; font-weight: 600; color: ${T.textMuted}; margin: 14px 0 4px; font-family: ${T.sans}; }
        .rg-md-h4 { font-size: 12px; font-weight: 600; color: ${T.textMuted}; margin: 10px 0 4px; font-family: ${T.sans}; }
        .rg-md-p  { font-size: 12.5px; color: ${T.textMuted}; line-height: 1.7; margin: 0 0 10px; font-family: ${T.sans}; }
        .rg-md-li { font-size: 12.5px; color: ${T.textMuted}; line-height: 1.65; margin-bottom: 4px; font-family: ${T.sans}; }
        .rg-md-ul { padding-left: 16px; margin: 6px 0 10px; list-style: disc; }
        .rg-md-link { color: ${T.cyan}; text-decoration: none; }
        .rg-md-link:hover { text-decoration: underline; }
        .rg-md-hr { border: none; border-top: 1px solid ${T.border}; margin: 16px 0; }
        .rg-md-bq { border-left: 3px solid ${T.border}; margin: 8px 0; padding: 4px 12px; color: ${T.textDim}; font-style: italic; font-size: 12px; }
        .rg-code-block {
          background: ${T.bg}; border: 1px solid ${T.border}; border-radius: 8px;
          padding: 12px 14px; margin: 10px 0; overflow-x: auto;
          font-family: ${T.mono}; font-size: 11.5px; color: ${T.green}; line-height: 1.6;
          position: relative;
        }
        .rg-code-block::before {
          content: attr(data-lang);
          position: absolute; top: 6px; right: 10px;
          font-size: 9px; color: ${T.textDim}; font-family: ${T.mono};
          text-transform: uppercase; letter-spacing: 0.08em;
        }
        .rg-inline-code {
          background: ${T.bgSurface}; border: 1px solid ${T.border};
          border-radius: 4px; padding: 1px 5px;
          font-family: ${T.mono}; font-size: 11px; color: ${T.cyan};
        }
        .rg-md-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
        .rg-md-td { padding: 6px 10px; border: 1px solid ${T.border}; color: ${T.textMuted}; font-family: ${T.sans}; }
        .rg-md-td:first-child { color: ${T.text}; font-weight: 500; }
      `}</style>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderBottom: `1px solid ${T.border}`,
        flexShrink: 0, background: T.bgElevated,
      }}>
        {/* View toggle */}
        <div style={{
          display: 'flex', background: T.bgSurface,
          border: `1px solid ${T.border}`, borderRadius: 7, padding: 3, gap: 2,
        }}>
          {(['preview', 'raw'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                height: 24, padding: '0 10px', borderRadius: 5, border: 'none',
                background: view === v ? T.bgActive : 'transparent',
                color: view === v ? T.text : T.textDim,
                fontFamily: T.mono, fontSize: 10.5, fontWeight: 500,
                cursor: 'pointer', letterSpacing: '0.04em', transition: 'all 0.12s',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Copy */}
        {readme && (
          <>
            <button
              onClick={handleCopy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 28, padding: '0 10px', borderRadius: 6,
                border: `1px solid ${copied ? T.green + '50' : T.border}`,
                background: copied ? T.green + '12' : T.bgSurface,
                color: copied ? T.green : T.textMuted,
                fontFamily: T.mono, fontSize: 10.5, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ fontSize: 11 }} />
              {copied ? 'Copied!' : 'Copy'}
            </button>

            <button
              onClick={handleDownload}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 28, padding: '0 10px', borderRadius: 6,
                border: `1px solid ${T.border}`,
                background: T.bgSurface, color: T.textMuted,
                fontFamily: T.mono, fontSize: 10.5, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <i className="ti ti-download" style={{ fontSize: 11 }} />
              .md
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>

        {!readme && !readmeLoading && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: T.bgSurface, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <i className="ti ti-file-description" style={{ fontSize: 20, color: T.textDim }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}>
              No README generated yet
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 20, lineHeight: 1.6 }}>
              Generate a developer-grade README with badges, architecture diagram, and full setup guide.
            </div>
            <button
              onClick={onGenerate}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 34, padding: '0 16px', borderRadius: 8,
                border: `1px solid ${T.borderMid}`,
                background: T.bgSurface, color: T.text,
                fontFamily: T.mono, fontSize: 11.5, fontWeight: 500,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <i className="ti ti-sparkles" style={{ fontSize: 12, color: T.cyan }} />
              Generate README
            </button>
          </div>
        )}

        {readmeLoading && (
          <div style={{ textAlign: 'center', paddingTop: 48 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: T.bgSurface, border: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
            }}>
              <i className="ti ti-loader-2" style={{
                fontSize: 20, color: T.cyan,
                animation: 'spin 1s linear infinite',
              }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: T.textMuted }}>
              Generating README…
            </div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 6, fontFamily: T.mono }}>
              analysing modules · writing sections · adding badges
            </div>
          </div>
        )}

        {readme && !readmeLoading && (
          view === 'raw' ? (
            /* Raw Markdown */
            <pre style={{
              fontFamily: T.mono, fontSize: 11.5, color: T.textMuted,
              lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0,
            }}>
              {readme}
            </pre>
          ) : (
            /* Rendered preview */
            <div
              dangerouslySetInnerHTML={{ __html: renderMarkdown(readme) }}
              style={{ minHeight: 100 }}
            />
          )
        )}
      </div>

      {/* Regenerate footer */}
      {readme && !readmeLoading && (
        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.mono, flex: 1 }}>
            README.md · {readme.split('\n').length} lines
          </span>
          <button
            onClick={onGenerate}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              height: 26, padding: '0 10px', borderRadius: 6,
              border: `1px solid ${T.border}`,
              background: T.bgSurface, color: T.textDim,
              fontFamily: T.mono, fontSize: 10.5, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <i className="ti ti-refresh" style={{ fontSize: 11 }} />
            Regenerate
          </button>
        </div>
      )}
    </div>
  );
}