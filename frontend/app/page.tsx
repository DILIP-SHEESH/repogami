'use client';

import React, { useState, useRef, useCallback } from 'react';
import { T } from '../theme';
import { AnalyzeResult, GNode, ArchResult } from '../types';

import EmptyState from '../components/EmptyState';
import LoadingScreen from '../components/LoadingScreen';
import FileTree from '../components/FileTree';
import GraphCanvas from '../components/GraphCanvas';
import SidebarShell from '../components/Sidebar';
import ArchitectureDiagram from '../components/ArchitectureDiagram';

export default function RepoGami() {
  const [url, setUrl] = useState('');
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState('');
  const [loadPct, setLoadPct] = useState(0);
  const [error, setError] = useState('');
  const [data, setData] = useState<AnalyzeResult | null>(null);

  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const graphRef = useRef<any>(null);

  const [blastMode, setBlastMode] = useState(false);
  const [blastLoading, setBlastLoading] = useState(false);

  const [sidebarTab, setSidebarTab] = useState<'node' | 'ai' | 'summary' | 'arch'>('summary');
  const [showTree, setShowTree] = useState(true);

  const [mobileTreeOpen, setMobileTreeOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [readme, setReadme] = useState('');
  const [readmeLoading, setReadmeLoading] = useState(false);

  const [arch, setArch] = useState<ArchResult | null>(null);
  const [archLoading, setArchLoading] = useState(false);
  const [archCanvasOpen, setArchCanvasOpen] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const analyze = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true); setError(''); setData(null); setSelectedNode(null);
    setHighlightNodes(new Set()); setHighlightLinks(new Set());
    setBlastMode(false); setAiAnswer(''); setArch(null); setReadme('');
    setLoadPct(0);

    const stages = [
      { label: 'Fetching file tree from GitHub…', pct: 15 },
      { label: 'Parsing dependency graph…',       pct: 40 },
      { label: 'Computing semantic roles…',        pct: 65 },
      { label: 'Building system blueprint…',       pct: 85 },
    ];
    let si = 0;
    setLoadStage(stages[0].label);
    setLoadPct(stages[0].pct);
    const t = setInterval(() => {
      si = Math.min(si + 1, stages.length - 1);
      setLoadStage(stages[si].label);
      setLoadPct(stages[si].pct);
    }, 1500);

    try {
      const res = await fetch(`${API}/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url }),
      });
      clearInterval(t); setLoadPct(100);
      if (!res.ok) throw new Error('Analysis failed.');
      const result = await res.json();
      setData(result);
      setAnalyzedUrl(url);
      setSidebarTab('summary');
    } catch {
      clearInterval(t);
      setError('Could not analyze repository. Verify the backend is running or check the URL.');
    } finally {
      setLoading(false); setLoadStage(''); setLoadPct(0);
    }
  }, [url, API]);

  const handleNodeClick = useCallback((node: GNode) => {
    setSelectedNode(node); setAiAnswer(''); setAiQuestion('');
    setBlastMode(false); setSidebarTab('node');

    if (window.innerWidth <= 992) {
      setMobileSidebarOpen(true);
      setMobileTreeOpen(false);
    }
    if (!data) return;

    const hn = new Set<string>([node.id]);
    const hl = new Set<string>();
    data.graph.links.forEach(l => {
      const s  = typeof l.source === 'object' ? l.source.id : l.source;
      const t2 = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === node.id || t2 === node.id) { hn.add(s); hn.add(t2); hl.add(`${s}→${t2}`); }
    });
    setHighlightNodes(hn); setHighlightLinks(hl);

    if (graphRef.current && node.x !== undefined) {
      graphRef.current.cameraPosition(
        { x: node.x, y: node.y, z: (node.z || 0) + 150 },
        { x: node.x, y: node.y, z: node.z || 0 }, 800
      );
    }
  }, [data]);

  const handleAsk = useCallback(async (qOverride?: string) => {
    const question = qOverride || aiQuestion;
    if (!selectedNode || !question.trim() || !data) return;
    setAiLoading(true); setSidebarTab('ai');
    if (qOverride) setAiQuestion(qOverride);

    const subgraph = data.graph.links
      .filter(l => {
        const s  = typeof l.source === 'object' ? l.source.id : l.source;
        const t2 = typeof l.target === 'object' ? l.target.id : l.target;
        return s === selectedNode.id || t2 === selectedNode.id;
      })
      .map(l => ({
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
      }));

    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: analyzedUrl, file_path: selectedNode.id, branch: data.meta.branch || 'main', subgraph, question }),
      });
      const result = await res.json();
      setAiAnswer(result.answer);
    } catch { setAiAnswer('Network error connecting to AI endpoint.'); }
    finally { setAiLoading(false); }
  }, [selectedNode, aiQuestion, data, analyzedUrl, API]);

  const runBlast = useCallback(() => {
    if (!selectedNode || !data) return;
    setBlastLoading(true);
    setTimeout(() => { setBlastMode(true); setBlastLoading(false); }, 500);
  }, [selectedNode, data]);

  const generateReadme = useCallback(async () => {
    if (!data) return;
    setReadmeLoading(true); setReadme('');
    try {
      const res = await fetch(`${API}/generate-readme`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: analyzedUrl, project_name: data.summary.project_name, tagline: data.summary.tagline,
          description: data.summary.description, tech_stack: data.summary.tech_stack, architecture: data.summary.architecture,
          entry_points: data.summary.entry_points, key_modules: data.summary.key_modules, insights: data.summary.insights,
          total_files: data.stats.total_files, total_edges: data.stats.total_edges, languages: data.stats.languages,
          file_tree_summary: data.graph.nodes.slice(0, 100).map(n => n.path).join('\n'),
          top_hubs: data.stats.top_hubs, orphan_count: data.stats.orphan_count, complexity: data.summary.complexity,
        }),
      });
      const result = await res.json();
      setReadme(result.readme);
    } catch { setReadme('Failed to generate README.'); }
    finally { setReadmeLoading(false); }
  }, [data, analyzedUrl, API]);

  const generateArchitecture = useCallback(async () => {
    if (!data) return;
    setArchLoading(true); setArch(null);
    try {
      const res = await fetch(`${API}/generate-architecture`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: analyzedUrl, project_name: data.summary.project_name, description: data.summary.description,
          tech_stack: data.summary.tech_stack, architecture: data.summary.architecture, key_modules: data.summary.key_modules,
          file_tree_summary: data.graph.nodes.slice(0, 150).map(n => n.path).join('\n'),
          languages: data.stats.languages, entry_points: data.summary.entry_points, total_files: data.stats.total_files,
        }),
      });
      const result = await res.json();
      setArch(result);
      setArchCanvasOpen(true);
    } catch { setArch(null); }
    finally { setArchLoading(false); }
  }, [data, analyzedUrl, API]);

  return (
    <div style={{
      background: T.bg, minHeight: '100vh', color: T.text, fontFamily: T.sans,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh',
    }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header className="rg-header">

        {/* Mobile tree toggle */}
        {data && (
          <button
            className="rg-mobile-toggle"
            onClick={() => setMobileTreeOpen(true)}
            aria-label="Open file tree"
          >
            <i className="ti ti-layout-sidebar" style={{ fontSize: 16 }} />
          </button>
        )}

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: T.text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <span style={{ color: T.bg, fontSize: 14, fontWeight: 700, fontFamily: T.mono, lineHeight: 1 }}>R</span>
            <div className="rg-logo-dot" />
          </div>
          <div>
            <div style={{
              fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em',
              color: T.text, lineHeight: 1.1, fontFamily: T.mono,
            }}>
              REPOGAMI
            </div>
            <div className="rg-logo-sub" style={{
              fontSize: 9, color: T.textDim, fontFamily: T.mono, letterSpacing: '0.06em',
            }}>
              CODEBASE INTEL
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="rg-header-sep" />

        {/* URL form — pill style */}
        <div className="rg-header-center">
          <form onSubmit={analyze} style={{ flex: 1, display: 'flex', maxWidth: 520 }}>
            <div className="rg-url-form">
              <i className="ti ti-brand-github" style={{ fontSize: 13, color: T.textDim, flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, fontFamily: T.mono, color: T.textDim, flexShrink: 0 }}>
                github.com/
              </span>
              <input
                className="rg-url-input"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="owner/repository"
                spellCheck={false}
                autoComplete="off"
              />
              <button
                type="submit"
                className="rg-submit-btn"
                disabled={loading || !url.trim()}
              >
                {loading ? 'Parsing…' : 'Analyze →'}
              </button>
            </div>
          </form>
        </div>

        {/* Right actions */}
        <div className="rg-header-right">
          {data && (
            <>
              {/* Stats pill */}
              <div className="rg-stats-pill">
                <span>
                  <span style={{ color: T.textMuted }}>{data.stats.total_files}</span> files
                </span>
                <span className="rg-stats-pill-sep" />
                <span>
                  <span style={{ color: T.amber }}>{data.stats.orphan_count}</span> orphans
                </span>
              </div>

              {/* Visual separator */}
              <div style={{ width: 1, height: 20, background: T.border, flexShrink: 0 }} />

              {/* Tree toggle */}
              <button
                onClick={() => setShowTree(v => !v)}
                className="rg-btn"
                style={{ gap: 5 }}
                title={showTree ? 'Hide file tree' : 'Show file tree'}
              >
                <i
                  className={`ti ${showTree
                    ? 'ti-layout-sidebar-left-collapse'
                    : 'ti-layout-sidebar-left-expand'}`}
                  style={{ fontSize: 13 }}
                />
                Tree
              </button>

              {/* Open on GitHub */}
              <button
                className="rg-icon-btn"
                title="Open on GitHub"
                onClick={() =>
                  window.open(
                    `https://github.com/${analyzedUrl.replace('https://github.com/', '')}`,
                    '_blank'
                  )
                }
              >
                <i className="ti ti-external-link" style={{ fontSize: 13 }} />
              </button>
            </>
          )}
        </div>

        {/* Mobile sidebar toggle */}
        {data && (
          <button
            className="rg-mobile-toggle"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            <i className="ti ti-layout-sidebar-right" style={{ fontSize: 16 }} />
          </button>
        )}
      </header>

      {/* ── ERROR BANNER ───────────────────────────────────────────────── */}
      {error && (
        <div style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)',
          background: `${T.red}14`, border: `1px solid ${T.red}40`,
          color: T.red, padding: '10px 18px', borderRadius: 8,
          fontSize: 12.5, fontFamily: T.sans, fontWeight: 500,
          zIndex: 200, display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fade-up 0.2s ease',
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 14 }} />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{
              background: 'none', border: 'none', color: T.red,
              marginLeft: 6, cursor: 'pointer', opacity: 0.65, padding: 0,
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 14 }} />
          </button>
        </div>
      )}

      {/* ── MAIN WORKSPACE ─────────────────────────────────────────────── */}
      <div className="rg-workspace">

        {/* Backdrop */}
        <div
          className={`rg-backdrop${mobileTreeOpen || mobileSidebarOpen ? ' active' : ''}`}
          onClick={() => { setMobileTreeOpen(false); setMobileSidebarOpen(false); }}
        />

        {/* File tree */}
        {data && showTree && (
          <div className={`rg-file-tree${mobileTreeOpen ? ' open' : ''}`}>
            <FileTree
              nodes={data.graph.nodes}
              selectedId={selectedNode?.id}
              onSelect={handleNodeClick}
            />
          </div>
        )}

        {/* Graph canvas */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: T.bg }}>
          {!data && !loading && <EmptyState />}
          {loading && <LoadingScreen stage={loadStage} pct={loadPct} />}
          {data && !loading && (
            <>
              <GraphCanvas
                data={data}
                highlightNodes={highlightNodes}
                highlightLinks={highlightLinks}
                selectedNode={selectedNode}
                handleNodeClick={handleNodeClick}
                graphRef={graphRef}
              />

              {/* Graph overlay — stats strip */}
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 16,
                background: `${T.bgElevated}E0`, backdropFilter: 'blur(8px)',
                border: `1px solid ${T.border}`, borderRadius: 8,
                padding: '6px 16px', fontSize: 10.5, fontFamily: T.mono, color: T.textDim,
                pointerEvents: 'none',
              }}>
                <span><span style={{ color: T.textMuted }}>{data.stats.total_files}</span> nodes</span>
                <span style={{ width: 1, height: 12, background: T.border }} />
                <span><span style={{ color: T.textMuted }}>{data.stats.total_edges}</span> edges</span>
                <span style={{ width: 1, height: 12, background: T.border }} />
                <span><span style={{ color: T.amber }}>{data.stats.orphan_count}</span> orphans</span>
                {selectedNode && (
                  <>
                    <span style={{ width: 1, height: 12, background: T.border }} />
                    <span style={{ color: T.cyan }}>● {selectedNode.name}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className={`rg-sidebar-shell${mobileSidebarOpen ? ' open' : ''}`}>
          <SidebarShell
            sidebarTab={sidebarTab} setSidebarTab={setSidebarTab}
            data={data} selectedNode={selectedNode}
            handleNodeClick={handleNodeClick} runBlast={runBlast} blastLoading={blastLoading}
            aiQuestion={aiQuestion} setAiQuestion={setAiQuestion}
            handleAsk={handleAsk} aiLoading={aiLoading} aiAnswer={aiAnswer}
            generateReadme={generateReadme} readmeLoading={readmeLoading} readme={readme}
            arch={arch} generateArchitecture={generateArchitecture} archLoading={archLoading}
          />
        </div>
      </div>

      {/* ── ARCH CANVAS OVERLAY ─────────────────────────────────────────── */}
      {archCanvasOpen && arch && (
        <ArchitectureDiagram
          arch={arch}
          repoUrl={analyzedUrl}
          onClose={() => setArchCanvasOpen(false)}
        />
      )}
    </div>
  );
}