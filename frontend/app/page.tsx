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
  const [url, setUrl]                     = useState('');
  const [analyzedUrl, setAnalyzedUrl]     = useState('');
  const [loading, setLoading]             = useState(false);
  const [loadStage, setLoadStage]         = useState('');
  const [loadPct, setLoadPct]             = useState(0);
  const [error, setError]                 = useState('');
  const [data, setData]                   = useState<AnalyzeResult | null>(null);

  const [selectedNode, setSelectedNode]   = useState<GNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const graphRef = useRef<any>(null);

  const [blastMode, setBlastMode]         = useState(false);
  const [blastLoading, setBlastLoading]   = useState(false);

  const [sidebarTab, setSidebarTab]       = useState<'node' | 'ai' | 'summary' | 'arch'>('summary');
  const [showTree, setShowTree]           = useState(true);

  const [mobileTreeOpen, setMobileTreeOpen]     = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [aiQuestion, setAiQuestion]       = useState('');
  const [aiAnswer, setAiAnswer]           = useState('');
  const [aiLoading, setAiLoading]         = useState(false);

  const [readme, setReadme]               = useState('');
  const [readmeLoading, setReadmeLoading] = useState(false);

  const [arch, setArch]                   = useState<ArchResult | null>(null);
  const [archLoading, setArchLoading]     = useState(false);
  const [archCanvasOpen, setArchCanvasOpen] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // ── Analyze ─────────────────────────────────────────────────────────────────
  const analyze = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true); setError(''); setData(null); setSelectedNode(null);
    setHighlightNodes(new Set()); setHighlightLinks(new Set());
    setBlastMode(false); setAiAnswer(''); setArch(null); setReadme('');
    setLoadPct(0);
    
    // Auto-close mobile sidebars on new search
    setMobileTreeOpen(false);
    setMobileSidebarOpen(false);

    const stages = [
      { label: 'Fetching file tree from GitHub…', pct: 15 },
      { label: 'Parsing dependency graph…',       pct: 40 },
      { label: 'Computing semantic roles…',        pct: 65 },
      { label: 'Building system blueprint…',       pct: 85 },
    ];
    let si = 0;
    setLoadStage(stages[0].label); setLoadPct(stages[0].pct);
    const t = setInterval(() => {
      si = Math.min(si + 1, stages.length - 1);
      setLoadStage(stages[si].label); setLoadPct(stages[si].pct);
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
      setError('Could not analyze repository. Check the URL or verify the backend is running.');
    } finally {
      setLoading(false); setLoadStage(''); setLoadPct(0);
    }
  }, [url, API]);

  // ── Node click ──────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: GNode) => {
    setSelectedNode(node); setAiAnswer(''); setAiQuestion('');
    setBlastMode(false); setSidebarTab('node');

    if (window.innerWidth <= 992) { setMobileSidebarOpen(true); setMobileTreeOpen(false); }
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

  // ── Ask AI ──────────────────────────────────────────────────────────────────
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

  // ── Blast radius ─────────────────────────────────────────────────────────────
  const runBlast = useCallback(() => {
    if (!selectedNode || !data) return;
    setBlastLoading(true);
    setTimeout(() => { setBlastMode(true); setBlastLoading(false); }, 500);
  }, [selectedNode, data]);

  // ── README ───────────────────────────────────────────────────────────────────
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

  // ── Architecture ─────────────────────────────────────────────────────────────
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
      setArch(result); setArchCanvasOpen(true);
    } catch { setArch(null); }
    finally { setArchLoading(false); }
  }, [data, analyzedUrl, API]);

  return (
    <div style={{
      background: T.bg, minHeight: '100vh', color: T.text, fontFamily: T.sans,
      display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100vh',
    }}>

      {/* ── HEADER (MOBBIN PILL) ──────────────────────────────────────────────── */}
      <div className="rg-header-wrapper">
        <header className="rg-header">
          
          {data && (
            <button className="rg-mobile-toggle hide-tablet" onClick={() => setMobileTreeOpen(true)} aria-label="Open file tree">
              <i className="ti ti-layout-sidebar" style={{ fontSize: 18 }} />
            </button>
          )}

          {/* Logo Section */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, cursor: 'pointer' }} onClick={() => window.location.reload()}>
            <div className="rg-logo-mark">R</div>
            <div className="rg-logo-text" style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', color: T.text }}>
              Repogami
            </div>
          </div>

          <div className="rg-header-sep hide-tablet" />

          {/* Center Input Wrapper */}
          <div className="rg-header-center">
            <form onSubmit={analyze} style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <div className="rg-url-form">
                <i className="ti ti-brand-github hide-mobile" style={{ fontSize: 18, color: T.textDim }} />
                <input
                  className="rg-url-input"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="owner/repo"
                  spellCheck={false}
                  autoComplete="off"
                  autoCorrect="off"
                />
              </div>
            </form>
          </div>

          {/* Action Button */}
          <button type="button" onClick={analyze} className="rg-submit-btn" disabled={loading || !url.trim()}>
            {loading ? (
               <><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> <span className="btn-text-full">Analyzing...</span></>
            ) : (
               <><span className="btn-text-full">Analyze</span><span className="btn-text-short" style={{ display: 'none' }}>Go</span></>
            )}
          </button>

          {/* Right actions (Stats & Graph view toggles) */}
          {data && (
            <div className="rg-header-right hide-tablet">
              <div className="rg-header-sep" />
              
              <div className="rg-stats-pill">
                <span style={{ color: T.text }}>{data.stats.total_files}</span> files
                <span className="rg-stats-pill-sep" />
                <span style={{ color: T.text }}>{data.stats.total_edges}</span> edges
              </div>

              <button
                onClick={() => setShowTree(v => !v)}
                className="rg-mobile-toggle"
                title={showTree ? 'Hide file tree' : 'Show file tree'}
                style={{ border: 'none', background: 'transparent' }}
              >
                <i className={`ti ${showTree ? 'ti-layout-sidebar-left-collapse' : 'ti-layout-sidebar-left-expand'}`} style={{ fontSize: 18 }} />
              </button>
            </div>
          )}

          {data && (
            <button className="rg-mobile-toggle hide-tablet" style={{ display: 'block' }} onClick={() => setMobileSidebarOpen(true)}>
               <i className="ti ti-layout-sidebar-right" style={{ fontSize: 18 }} />
            </button>
          )}

        </header>
      </div>

      {/* ── ERROR TOAST ──────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          position: 'absolute', top: 90, left: '50%', transform: 'translateX(-50%)',
          background: T.bgSurface, border: `1px solid ${T.border}`,
          color: T.red, padding: '12px 20px', borderRadius: 12,
          fontSize: 13, fontFamily: T.sans, fontWeight: 500,
          zIndex: 200, display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: `0 8px 32px rgba(0,0,0,0.1)`,
          animation: 'fade-up 0.2s ease',
          maxWidth: '90vw', width: 420,
        }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 16, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: 4, flexShrink: 0 }}
          >
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>
      )}

      {/* ── WORKSPACE ────────────────────────────────────────────────────── */}
      <div className="rg-workspace">

        <div
          className={`rg-backdrop${mobileTreeOpen || mobileSidebarOpen ? ' active' : ''}`}
          onClick={() => { setMobileTreeOpen(false); setMobileSidebarOpen(false); }}
        />

        {/* File tree */}
        {data && showTree && (
          <div className={`rg-file-tree${mobileTreeOpen ? ' open' : ''}`}>
            <FileTree nodes={data.graph.nodes} selectedId={selectedNode?.id} onSelect={handleNodeClick} />
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

              {/* Bottom info strip */}
              <div className="rg-graph-strip">
                <span>
                  <span style={{ fontWeight: 600, color: T.text }}>{data.stats.total_files}</span> nodes
                </span>
                <span className="rg-graph-strip-sep" />
                <span>
                  <span style={{ fontWeight: 600, color: T.text }}>{data.stats.total_edges}</span> edges
                </span>
                <span className="rg-graph-strip-sep" />
                <span>
                  <span style={{ fontWeight: 600, color: T.amber }}>{data.stats.orphan_count}</span> orphans
                </span>
                {selectedNode && (
                  <>
                    <span className="rg-graph-strip-sep hide-mobile" />
                    <span style={{ color: T.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <i className="ti ti-point-filled" style={{ fontSize: 8 }} />
                      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {selectedNode.name}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Sidebar */}
        <div className={`rg-sidebar-shell${mobileSidebarOpen ? ' open' : ''}`}>
          <SidebarShell
            sidebarTab={sidebarTab}       setSidebarTab={setSidebarTab}
            data={data}                   selectedNode={selectedNode}
            handleNodeClick={handleNodeClick}
            runBlast={runBlast}           blastLoading={blastLoading}
            aiQuestion={aiQuestion}       setAiQuestion={setAiQuestion}
            handleAsk={handleAsk}         aiLoading={aiLoading}
            aiAnswer={aiAnswer}
            generateReadme={generateReadme} readmeLoading={readmeLoading} readme={readme}
            arch={arch}                   generateArchitecture={generateArchitecture}
            archLoading={archLoading}
          />
        </div>
      </div>

      {/* ── ARCH OVERLAY ─────────────────────────────────────────────────── */}
      {archCanvasOpen && arch && (
        <ArchitectureDiagram arch={arch} repoUrl={analyzedUrl} onClose={() => setArchCanvasOpen(false)} />
      )}
    </div>
  );
}