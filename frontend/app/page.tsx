'use client';

/**
 * RepoGami — Codebase Intelligence Workbench
 *
 * Three-panel layout:
 *   LEFT   — File tree (collapsible, click to filter graph)
 *   CENTER — 3D force-directed dependency graph
 *   RIGHT  — Node inspector + AI chat + project summary
 *
 * Node colors = semantic role (not file type):
 *   🟡 amber  — entry point (nothing imports it, it starts execution)
 *   🩵 teal   — hub / core module (4+ files depend on it)
 *   🔵 blue   — shared module (2–3 dependents)
 *   ⚫ gray   — leaf (normal file)
 *   🔴 red    — orphan / dead code (isolated, no imports in or out)
 *   ◼ dark   — config / docs
 */

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo
} from 'react';
import dynamic from 'next/dynamic';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

// ─── Types ──────────────────────────────────────────────────────────────────

type Role = 'entry' | 'hub' | 'shared' | 'leaf' | 'orphan' | 'config';

interface GNode {
  id: string;
  name: string;
  path: string;
  dir: string;
  language: string;
  lang_color: string;
  extension: string;
  size: number;
  role: Role;
  indegree: number;
  outdegree: number;
  dependents: string[];
  dependencies: string[];
  is_orphan: boolean;
  is_entry: boolean;
  is_hub: boolean;
  is_config: boolean;
  // runtime (three-forcegraph)
  x?: number; y?: number; z?: number;
  __threeObj?: any;
}

interface GLink {
  source: string | GNode;
  target: string | GNode;
}

interface Summary {
  project_name: string;
  tagline: string;
  description: string;
  tech_stack: string[];
  architecture: string;
  entry_points: string[];
  key_modules: string[];
  complexity: 'low' | 'medium' | 'high';
  insights: string[];
}

interface Stats {
  total_files: number;
  total_edges: number;
  orphan_count: number;
  hub_count: number;
  entry_count: number;
  shared_count: number;
  languages: Record<string, number>;
  top_hubs: { id: string; name: string; indegree: number }[];
  role_counts: Record<string, number>;
}

interface AnalyzeResult {
  graph: { nodes: GNode[]; links: GLink[] };
  summary: Summary;
  stats: Stats;
  meta: { owner: string; repo: string; url: string; truncated: boolean; files_fetched_for_deps: number };
}

// ─── Role definitions ──────────────────────────────────────────────────────

const ROLES: Record<Role, { color: string; label: string; description: string }> = {
  entry:  { color: '#F59E0B', label: 'Entry point',   description: 'Where execution begins. Nothing imports this.' },
  hub:    { color: '#14B8A6', label: 'Core module',   description: 'Imported by 4+ files. Critical — changes here propagate widely.' },
  shared: { color: '#60A5FA', label: 'Shared module', description: 'Imported by 2–3 files.' },
  leaf:   { color: '#9CA3AF', label: 'Regular file',  description: 'Standard file with limited dependents.' },
  orphan: { color: '#EF4444', label: 'Dead code ⚠',  description: 'Nothing imports this, and it imports nothing. Safe to delete?' },
  config: { color: '#6B7280', label: 'Config / docs', description: 'Configuration or documentation file.' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nodeSize(n: GNode): number {
  if (n.is_hub)    return 8;
  if (n.is_entry)  return 6;
  if (n.role === 'shared') return 5;
  if (n.is_orphan) return 3;
  if (n.is_config) return 2;
  return 4;
}

function getId(x: string | GNode): string {
  return typeof x === 'object' ? x.id : x;
}

function formatBytes(b: number): string {
  if (!b) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ─── File Tree Component ──────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: Record<string, TreeNode>;
  fileNode?: GNode;
}

function buildTree(nodes: GNode[]): TreeNode {
  const root: TreeNode = { name: '/', path: '', isFile: false, children: {} };
  for (const node of nodes) {
    const parts = node.path.split('/');
    let cur = root;
    parts.forEach((part, i) => {
      if (!cur.children[part]) {
        cur.children[part] = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          isFile: i === parts.length - 1,
          children: {},
          fileNode: i === parts.length - 1 ? node : undefined,
        };
      }
      cur = cur.children[part];
    });
  }
  return root;
}

const FileTreeNode = memo(({
  node, depth, selectedId, onSelect, highlightIds, filterDir, onFilterDir,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (n: GNode) => void;
  highlightIds: Set<string>;
  filterDir: string | null;
  onFilterDir: (dir: string | null) => void;
}) => {
  const [open, setOpen] = useState(depth < 2);
  const isDir = !node.isFile;
  const isSelected = node.fileNode?.id === selectedId;
  const isFiltered = filterDir === node.path;
  const hasHighlight = node.fileNode && highlightIds.has(node.fileNode.id);

  if (node.isFile && node.fileNode) {
    const fn = node.fileNode;
    const roleColor = ROLES[fn.role].color;
    return (
      <div
        onClick={() => onSelect(fn)}
        style={{
          paddingLeft: depth * 12 + 8,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isSelected
            ? 'rgba(245,158,11,0.12)'
            : hasHighlight
              ? 'rgba(0,0,0,0.03)'
              : 'transparent',
          borderLeft: isSelected ? '2px solid #F59E0B' : '2px solid transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = isSelected ? 'rgba(245,158,11,0.18)' : 'rgba(0,0,0,0.04)')}
        onMouseLeave={e => (e.currentTarget.style.background = isSelected ? 'rgba(245,158,11,0.12)' : hasHighlight ? 'rgba(0,0,0,0.03)' : 'transparent')}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor, flexShrink: 0 }} />
        <span style={{
          fontSize: 12,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          color: isSelected ? '#111827' : (highlightIds.size > 0 && !hasHighlight ? '#9CA3AF' : '#374151'),
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {fn.name}
        </span>
        {fn.indegree > 0 && (
          <span style={{ fontSize: 10, color: '#14B8A6', flexShrink: 0 }}>{fn.indegree}</span>
        )}
      </div>
    );
  }

  const children = Object.values(node.children).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div
        onClick={() => setOpen(o => !o)}
        onDoubleClick={() => onFilterDir(isFiltered ? null : node.path)}
        title="Double-click to filter graph to this folder"
        style={{
          paddingLeft: depth * 12 + 4,
          paddingRight: 8,
          paddingTop: 4,
          paddingBottom: 4,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: isFiltered ? 'rgba(20,184,166,0.1)' : 'transparent',
          borderLeft: isFiltered ? '2px solid #14B8A6' : '2px solid transparent',
        }}
      >
        <span style={{ color: '#9CA3AF', fontSize: 10, width: 10, flexShrink: 0 }}>
          {open ? '▾' : '▸'}
        </span>
        <span style={{
          fontSize: 12,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          fontWeight: 500,
          color: isFiltered ? '#14B8A6' : '#4B5563',
          whiteSpace: 'nowrap',
        }}>
          {node.name}
        </span>
      </div>
      {open && (
        <div>
          {children.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              highlightIds={highlightIds}
              filterDir={filterDir}
              onFilterDir={onFilterDir}
            />
          ))}
        </div>
      )}
    </div>
  );
});
FileTreeNode.displayName = 'FileTreeNode';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RepoGami() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadStage, setLoadStage] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState<AnalyzeResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());
  const [blastNodes, setBlastNodes] = useState<Set<string>>(new Set());
  const [filterRole, setFilterRole] = useState<Role | null>(null);
  const [filterDir, setFilterDir] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'node' | 'ai' | 'summary'>('node');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [blastMode, setBlastMode] = useState(false);
  const [blastLoading, setBlastLoading] = useState(false);
  const [showTree, setShowTree] = useState(true);
  const [readme, setReadme] = useState('');
  const [readmeLoading, setReadmeLoading] = useState(false);

  const graphRef = useRef<any>(null);
  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  // ── Analyze ───────────────────────────────────────────────────────────────

  const analyze = useCallback(async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setData(null);
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
    setBlastNodes(new Set());
    setFilterRole(null);
    setFilterDir(null);
    setAiAnswer('');

    const stages = [
      'Fetching file tree from GitHub...',
      'Parsing dependencies...',
      'Computing semantic roles...',
      'Running AI analysis...',
    ];
    let si = 0;
    setLoadStage(stages[0]);
    const stageTimer = setInterval(() => {
      si = Math.min(si + 1, stages.length - 1);
      setLoadStage(stages[si]);
    }, 1800);

    try {
      const res = await fetch(`${API}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url }),
      });
      clearInterval(stageTimer);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const result: AnalyzeResult = await res.json();
      setData(result);
      setSidebarTab('summary');
    } catch (e: any) {
      clearInterval(stageTimer);
      setError(e.message || 'Analysis failed. Check the backend is running.');
    } finally {
      setLoading(false);
      setLoadStage('');
    }
  }, [url, API]);

  // ── Node click ────────────────────────────────────────────────────────────

  const handleNodeClick = useCallback((raw: any) => {
    const node = raw as GNode;
    setSelectedNode(node);
    setAiAnswer('');
    setAiQuestion('');
    setBlastNodes(new Set());
    setBlastMode(false);
    setSidebarTab('node');

    if (!data) return;

    const hn = new Set<string>([node.id]);
    const hl = new Set<string>();
    data.graph.links.forEach(l => {
      const s = getId(l.source), t = getId(l.target);
      if (s === node.id || t === node.id) {
        hn.add(s);
        hn.add(t);
        hl.add(`${s}→${t}`);
      }
    });
    setHighlightNodes(hn);
    setHighlightLinks(hl);

    // Fly camera to node
    if (graphRef.current && node.x !== undefined) {
      graphRef.current.cameraPosition(
        { x: node.x, y: node.y, z: (node.z || 0) + 150 },
        { x: node.x, y: node.y, z: node.z || 0 },
        800,
      );
    }
  }, [data]);

  // ── Blast radius ──────────────────────────────────────────────────────────

  const runBlast = useCallback(async () => {
    if (!selectedNode || !data) return;
    setBlastLoading(true);
    setBlastMode(true);

    const edges = data.graph.links.map(l => ({
      source: getId(l.source),
      target: getId(l.target),
    }));

    try {
      const res = await fetch(`${API}/blast-radius`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edges, node_id: selectedNode.id, depth: 5 }),
      });
      const result = await res.json();
      setBlastNodes(new Set(result.affected_files));

      // Highlight all blast nodes
      const hn = new Set<string>([selectedNode.id, ...result.affected_files]);
      setHighlightNodes(hn);
    } catch {
      setBlastNodes(new Set());
    } finally {
      setBlastLoading(false);
    }
  }, [selectedNode, data, API]);

  // ── AI Ask ────────────────────────────────────────────────────────────────

  const handleAsk = useCallback(async (question?: string) => {
    const q = question || aiQuestion;
    if (!selectedNode || !q.trim() || !data) return;
    setAiLoading(true);
    setAiAnswer('');
    setSidebarTab('ai');
    if (question) setAiQuestion(question);

    const subgraph = data.graph.links
      .filter(l => {
        const s = getId(l.source), t = getId(l.target);
        return s === selectedNode.id || t === selectedNode.id;
      })
      .map(l => ({ source: getId(l.source), target: getId(l.target) }));

    try {
      const res = await fetch(`${API}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: url,
          file_path: selectedNode.id,
          question: q,
          subgraph,
        }),
      });
      const result = await res.json();
      setAiAnswer(result.answer);
    } catch {
      setAiAnswer('Request failed. Check your GROQ_API_KEY in the backend .env.');
    } finally {
      setAiLoading(false);
    }
  }, [selectedNode, aiQuestion, data, url, API]);

  // ── Generate Readme ─────────────────────────────────────────────────────

  const generateReadme = useCallback(async () => {
    if (!data) return;
    setReadmeLoading(true);
    setReadme('');

    try {
      const res = await fetch(`${API}/generate-readme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: url,
          project_name: data.summary.project_name,
          tagline: data.summary.tagline,
          description: data.summary.description,
          tech_stack: data.summary.tech_stack,
          architecture: data.summary.architecture,
          entry_points: data.summary.entry_points,
          key_modules: data.summary.key_modules,
          insights: data.summary.insights,
          total_files: data.stats.total_files,
          total_edges: data.stats.total_edges,
          languages: data.stats.languages,
          file_tree_summary: data.graph.nodes.slice(0, 100).map(n => n.path).join('\n'),
        }),
      });
      const result = await res.json();
      setReadme(result.readme);
    } catch {
      setReadme('Failed to generate README. Check backend and API key.');
    } finally {
      setReadmeLoading(false);
    }
  }, [data, url, API]);

  // ── Filtered graph ────────────────────────────────────────────────────────

  const filteredGraph = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    let nodes = data.graph.nodes;
    if (filterRole) nodes = nodes.filter(n => n.role === filterRole);
    if (filterDir)  nodes = nodes.filter(n => n.path.startsWith(filterDir + '/') || n.dir === filterDir);
    const ids = new Set(nodes.map(n => n.id));
    const links = data.graph.links.filter(l => ids.has(getId(l.source)) && ids.has(getId(l.target)));
    return { nodes, links };
  }, [data, filterRole, filterDir]);

  // ── Node color ────────────────────────────────────────────────────────────

  const getNodeColor = useCallback((raw: any): string => {
    const n = raw as GNode;
    const base = ROLES[n.role].color;
    if (blastMode) {
      if (n.id === selectedNode?.id) return '#FFFFFF';
      if (blastNodes.has(n.id)) return '#EF4444';
      return '#1F2937';
    }
    if (highlightNodes.size > 0) {
      if (n.id === selectedNode?.id) return '#FFFFFF';
      if (!highlightNodes.has(n.id)) return '#1A1A2E';
      return base;
    }
    return base;
  }, [highlightNodes, selectedNode, blastMode, blastNodes]);

  const getLinkColor = useCallback((raw: any): string => {
    const s = getId(raw.source), t = getId(raw.target);
    const key = `${s}→${t}`;
    if (blastMode) {
      if (blastNodes.has(s) && (blastNodes.has(t) || t === selectedNode?.id)) return 'rgba(239,68,68,0.6)';
      return 'rgba(255,255,255,0.03)';
    }
    if (highlightLinks.size > 0) {
      return highlightLinks.has(key) ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.04)';
    }
    return 'rgba(107,114,128,0.18)';
  }, [highlightLinks, blastMode, blastNodes, selectedNode]);

  // ── File tree ─────────────────────────────────────────────────────────────

  const fileTree = useMemo(() => {
    if (!data) return null;
    return buildTree(data.graph.nodes);
  }, [data]);

  // ── Keyboard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.target as HTMLElement)?.id === 'repo-url') analyze();
      if (e.key === 'Escape') {
        setSelectedNode(null);
        setHighlightNodes(new Set());
        setHighlightLinks(new Set());
        setBlastNodes(new Set());
        setBlastMode(false);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [analyze]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: '#F8F6F0',      // soft warm beige
      minHeight: '100vh',
      color: '#1F2937',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      height: '100vh',
    }}>

      {/* ═══════════════════════════════════════════════════════ HEADER ═══ */}
      <div style={{
        height: 56,
        borderBottom: '1px solid #E5E0D8',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 16,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="2" fill="#F59E0B"/>
            <circle cx="3" cy="5" r="1.5" fill="#14B8A6"/>
            <circle cx="17" cy="5" r="1.5" fill="#EF4444"/>
            <circle cx="3" cy="15" r="1.5" fill="#60A5FA"/>
            <circle cx="17" cy="15" r="1.5" fill="#14B8A6"/>
            <line x1="10" y1="10" x2="3" y2="5" stroke="#14B8A6" strokeWidth="0.8" strokeOpacity="0.6"/>
            <line x1="10" y1="10" x2="17" y2="5" stroke="#EF4444" strokeWidth="0.8" strokeOpacity="0.6"/>
            <line x1="10" y1="10" x2="3" y2="15" stroke="#60A5FA" strokeWidth="0.8" strokeOpacity="0.6"/>
            <line x1="10" y1="10" x2="17" y2="15" stroke="#14B8A6" strokeWidth="0.8" strokeOpacity="0.6"/>
          </svg>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#B45309',   // darker amber for contrast on light bg
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}>REPOGAMI</span>
        </div>

        {/* URL Input */}
        <div style={{ flex: 1, display: 'flex', gap: 8, maxWidth: 600 }}>
          <input
            id="repo-url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="github.com/owner/repo"
            style={{
              flex: 1,
              background: '#FFFFFF',
              border: '1px solid #D1CEC8',
              color: '#111827',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#F59E0B';
              e.target.style.boxShadow = '0 0 0 2px rgba(245,158,11,0.15)';
            }}
            onBlur={e => {
              e.target.style.borderColor = '#D1CEC8';
              e.target.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={analyze}
            disabled={loading}
            style={{
              background: loading ? '#E5E0D8' : '#F59E0B',
              color: loading ? '#9CA3AF' : '#FFF7ED',
              border: 'none',
              padding: '10px 20px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: loading ? 'default' : 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              boxShadow: loading ? 'none' : '0 2px 6px rgba(245,158,11,0.25)',
            }}
          >
            {loading ? 'PARSING...' : 'ANALYZE →'}
          </button>
        </div>

        {/* Role filter legend */}
        {data && (
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {(Object.entries(ROLES) as [Role, typeof ROLES[Role]][]).map(([role, def]) => {
              const count = data.stats.role_counts[role] || 0;
              if (!count && role !== 'orphan') return null;
              return (
                <button
                  key={role}
                  onClick={() => setFilterRole(filterRole === role ? null : role)}
                  title={def.description}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 12px',
                    borderRadius: 20,
                    border: `1px solid ${filterRole === role ? def.color : '#D1CEC8'}`,
                    background: filterRole === role ? `${def.color}10` : '#FFFFFF',
                    color: filterRole === role ? def.color : '#6B7280',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    fontWeight: 500,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: def.color }} />
                  <span>{role}</span>
                  <span style={{ color: filterRole === role ? def.color : '#9CA3AF' }}>{count}</span>
                </button>
              );
            })}
            {filterDir && (
              <button
                onClick={() => setFilterDir(null)}
                style={{
                  padding: '5px 14px', borderRadius: 20,
                  border: '1px solid #14B8A6', background: 'rgba(20,184,166,0.08)',
                  color: '#14B8A6', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                📁 {filterDir.split('/').pop()} ✕
              </button>
            )}
          </div>
        )}

        {/* Tree toggle */}
        {data && (
          <button
            onClick={() => setShowTree(v => !v)}
            title="Toggle file tree"
            style={{
              background: '#FFFFFF',
              border: '1px solid #D1CEC8',
              color: '#4B5563',
              padding: '6px 14px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            {showTree ? '⊠ tree' : '☰ tree'}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          background: '#FFF0F0',
          borderBottom: '1px solid #FECACA',
          color: '#B91C1C',
          padding: '12px 24px',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ color: '#EF4444' }}>⚠</span>
          {error}
          <button
            onClick={() => setError('')}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 14 }}
          >✕</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ BODY ════ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* ══════════════════════════════════ LEFT: FILE TREE ══════════ */}
        {data && showTree && (
          <div style={{
            width: 250,
            borderRight: '1px solid #E5E0D8',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 16px 10px',
              fontSize: 11,
              color: '#9CA3AF',
              letterSpacing: '0.12em',
              fontWeight: 700,
              borderBottom: '1px solid #F0ECE4',
              flexShrink: 0,
              textTransform: 'uppercase',
            }}>
              File Tree
              <span style={{ float: 'right', color: '#C4B8AA', fontWeight: 400, textTransform: 'none', fontSize: 10 }}>
                dbl-click to filter
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingTop: 4 }}>
              {fileTree && Object.values(fileTree.children)
                .sort((a, b) => {
                  if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
                  return a.name.localeCompare(b.name);
                })
                .map(child => (
                  <FileTreeNode
                    key={child.path}
                    node={child}
                    depth={0}
                    selectedId={selectedNode?.id || null}
                    onSelect={handleNodeClick}
                    highlightIds={highlightNodes}
                    filterDir={filterDir}
                    onFilterDir={setFilterDir}
                  />
                ))}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════ CENTER: GRAPH ═════════════ */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0, background: '#1E1B18' }}> {/* dark graph area for contrast */}

          {/* Empty state */}
          {!data && !loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 32,
              padding: '20px',
              background: '#F8F6F0',   // beige empty state on the graph area
            }}>
              <div style={{ textAlign: 'center', maxWidth: 560 }}>
                <div style={{
                  fontSize: 44,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#1F2937',
                  lineHeight: 1.2,
                  marginBottom: 16,
                }}>
                  Understand any codebase.<br />
                  <span style={{ color: '#14B8A6' }}>In seconds.</span>
                </div>
                <p style={{ color: '#6B7280', fontSize: 15, lineHeight: 1.6, margin: 0 }}>
                  Paste a GitHub URL. Get a live dependency graph colored by semantic role — entry points, dead code, core modules — not just file types.
                </p>
              </div>

              {/* Feature grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, maxWidth: 640 }}>
                {[
                  { color: ROLES.orphan.color, icon: '⚠', title: 'Dead code', desc: 'Files nobody imports, instantly visible' },
                  { color: ROLES.entry.color, icon: '→', title: 'Entry points', desc: 'Where your execution begins' },
                  { color: ROLES.hub.color, icon: '◎', title: 'Core modules', desc: 'Files everything depends on' },
                  { color: '#6B7280', icon: '✦', title: 'Blast radius', desc: 'What breaks if you change X?' },
                ].map(f => (
                  <div key={f.title} style={{
                    background: '#FFFFFF',
                    border: '1px solid #E5E0D8',
                    borderRadius: 12,
                    padding: 20,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ fontSize: 24, color: f.color, marginBottom: 12 }}>{f.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1F2937', marginBottom: 4 }}>{f.title}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>{f.desc}</div>
                  </div>
                ))}
              </div>

              {/* Quick examples */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>TRY AN EXAMPLE</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    ['fastapi/fastapi', 'Python API'],
                    ['pallets/flask', 'Python web'],
                    ['vitejs/vite', 'TypeScript build'],
                    ['sindresorhus/got', 'JS library'],
                  ].map(([repo, label]) => (
                    <button
                      key={repo}
                      onClick={() => setUrl(`https://github.com/${repo}`)}
                      style={{
                        background: '#FFFFFF',
                        border: '1px solid #D1CEC8',
                        color: '#4B5563',
                        padding: '8px 14px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontFamily: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#F59E0B')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#D1CEC8')}
                    >
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{repo}</span>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 20,
              background: '#F8F6F0',
            }}>
              <div style={{
                width: 48, height: 48,
                border: '2px solid #D1CEC8',
                borderTopColor: '#F59E0B',
                borderRadius: '50%',
                animation: 'spin 0.9s linear infinite',
              }} />
              <div style={{ fontSize: 14, color: '#6B7280', letterSpacing: '0.04em' }}>
                {loadStage}
              </div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Graph */}
          {data && !loading && (
            <ForceGraph3D
              ref={graphRef}
              graphData={filteredGraph}
              backgroundColor="#1E1B18"
              nodeId="id"
              nodeLabel={(n: any) => {
                const node = n as GNode;
                return `${node.path} · ${ROLES[node.role].label} · ↑${node.indegree} ↓${node.outdegree}`;
              }}
              nodeColor={getNodeColor}
              nodeVal={(n: any) => nodeSize(n as GNode)}
              linkColor={getLinkColor}
              linkWidth={(l: any) => {
                const k = `${getId(l.source)}→${getId(l.target)}`;
                if (blastMode) {
                  const s = getId(l.source), t = getId(l.target);
                  return (blastNodes.has(s) || s === selectedNode?.id) && (blastNodes.has(t) || t === selectedNode?.id) ? 1.5 : 0.2;
                }
                return highlightLinks.has(k) ? 1.5 : 0.4;
              }}
              linkDirectionalArrowLength={3}
              linkDirectionalArrowRelPos={1}
              linkDirectionalParticles={(l: any) => {
                const k = `${getId(l.source)}→${getId(l.target)}`;
                if (blastMode) {
                  const s = getId(l.source), t = getId(l.target);
                  return (blastNodes.has(s) || s === selectedNode?.id) ? 2 : 0;
                }
                return highlightLinks.has(k) ? 2 : 0;
              }}
              linkDirectionalParticleSpeed={0.003}
              linkDirectionalParticleColor={(l: any) => {
                if (blastMode) return '#EF4444';
                return '#F59E0B';
              }}
              onNodeClick={handleNodeClick}
              onBackgroundClick={() => {
                setSelectedNode(null);
                setHighlightNodes(new Set());
                setHighlightLinks(new Set());
                setBlastNodes(new Set());
                setBlastMode(false);
              }}
              cooldownTicks={100}
              onEngineStop={() => graphRef.current?.zoomToFit(400, 60)}
            />
          )}

          {/* ── Stats bar (bottom left) ──────────────────────────────── */}
          {data && (
            <div style={{
              position: 'absolute', bottom: 20, left: showTree ? 270 : 20,
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(8px)',
              border: '1px solid #D1CEC8',
              borderRadius: 12,
              padding: '12px 20px',
              display: 'flex',
              gap: 28,
              fontSize: 12,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)',
            }}>
              {[
                { v: data.stats.total_files, l: 'files', c: '#4B5563' },
                { v: data.stats.total_edges, l: 'edges', c: '#4B5563' },
                { v: data.stats.entry_count, l: 'entry', c: ROLES.entry.color },
                { v: data.stats.hub_count, l: 'hubs', c: ROLES.hub.color },
                { v: data.stats.orphan_count, l: 'dead', c: data.stats.orphan_count > 0 ? ROLES.orphan.color : '#9CA3AF' },
              ].map(s => (
                <div key={s.l} style={{ textAlign: 'center' }}>
                  <div style={{ color: s.c, fontWeight: 700, fontSize: 16, fontFamily: "'JetBrains Mono', monospace" }}>{s.v}</div>
                  <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}

          {/* ── Blast mode badge ────────────────────────────────────── */}
          {blastMode && (
            <div style={{
              position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
              background: '#FFF1F0',
              border: '1px solid #FCA5A5',
              color: '#B91C1C',
              padding: '10px 24px',
              borderRadius: 12,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontWeight: 500,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 10px 20px -10px rgba(239,68,68,0.15)',
            }}>
              <span style={{ color: '#EF4444' }}>◉</span>
              BLAST RADIUS — {blastNodes.size} files would break
              <button
                onClick={() => { setBlastMode(false); setBlastNodes(new Set()); setHighlightNodes(new Set()); }}
                style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', fontSize: 16 }}
              >✕</button>
            </div>
          )}

          {/* ── ESC hint ────────────────────────────────────────────── */}
          {selectedNode && !blastMode && (
            <div style={{
              position: 'absolute', bottom: 20, right: 370,
              fontSize: 12, color: '#9CA3AF',
              fontWeight: 500,
            }}>
              ESC to deselect
            </div>
          )}
        </div>

        {/* ═══════════════════════════════ RIGHT: SIDEBAR ══════════════ */}
        <div style={{
          width: 360,
          flexShrink: 0,
          background: '#FFFFFF',
          borderLeft: '1px solid #E5E0D8',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.02)',
        }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #E5E0D8', flexShrink: 0, padding: '0 16px' }}>
            {(['node', 'ai', 'summary'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                style={{
                  flex: 1,
                  padding: '14px 0',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: sidebarTab === tab
                    ? `2px solid ${tab === 'ai' ? '#14B8A6' : '#F59E0B'}`
                    : '2px solid transparent',
                  color: sidebarTab === tab
                    ? (tab === 'ai' ? '#14B8A6' : '#F59E0B')
                    : '#9CA3AF',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
              >
                {tab === 'node' ? 'NODE' : tab === 'ai' ? 'ASK AI' : 'PROJECT'}
              </button>
            ))}
          </div>

          {/* ── NODE TAB ───────────────────────────────────────────────── */}
          {sidebarTab === 'node' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 18px' }}>
              {!selectedNode ? (
                <div style={{ paddingTop: 60, textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 16, opacity: 0.3 }}>◎</div>
                  <div style={{ fontSize: 14, color: '#9CA3AF', lineHeight: 1.6 }}>
                    Click any node in the graph<br />to inspect it
                  </div>
                  {data && (
                    <div style={{ marginTop: 28 }}>
                      <div style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.1em', marginBottom: 16, fontWeight: 700, textTransform: 'uppercase' }}>
                        Top Core Modules
                      </div>
                      {data.stats.top_hubs.map(h => (
                        <div
                          key={h.id}
                          onClick={() => {
                            const node = data.graph.nodes.find(n => n.id === h.id);
                            if (node) handleNodeClick(node);
                          }}
                          style={{
                            padding: '12px 14px', marginBottom: 8,
                            background: '#F9F8F6',
                            borderRadius: 10,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: '1px solid #E5E0D8',
                            transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.borderColor = '#14B8A6')}
                          onMouseLeave={e => (e.currentTarget.style.borderColor = '#E5E0D8')}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLES.hub.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#111827', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace" }}>{h.name}</span>
                          <span style={{ fontSize: 12, color: '#14B8A6', fontWeight: 600 }}>↑{h.indegree}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Role badge */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '6px 14px', borderRadius: 8, marginBottom: 16,
                    background: `${ROLES[selectedNode.role].color}15`,
                    border: `1px solid ${ROLES[selectedNode.role].color}40`,
                    color: ROLES[selectedNode.role].color,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLES[selectedNode.role].color }} />
                    {ROLES[selectedNode.role].label}
                  </div>

                  {/* File name */}
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4, wordBreak: 'break-all', fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedNode.name}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20, wordBreak: 'break-all', lineHeight: 1.6 }}>
                    {selectedNode.path}
                  </div>

                  {/* Role description */}
                  <div style={{
                    background: '#F9F8F6',
                    borderRadius: 8,
                    padding: '12px 14px',
                    fontSize: 13,
                    color: '#4B5563',
                    lineHeight: 1.6,
                    marginBottom: 20,
                    border: '1px solid #E5E0D8',
                  }}>
                    {ROLES[selectedNode.role].description}
                  </div>

                  {/* Metrics grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                    {[
                      { v: selectedNode.indegree, l: 'imported by', c: '#14B8A6' },
                      { v: selectedNode.outdegree, l: 'imports', c: '#60A5FA' },
                      { v: selectedNode.language, l: 'language', c: '#6B7280' },
                      { v: formatBytes(selectedNode.size), l: 'file size', c: '#6B7280' },
                    ].map(m => (
                      <div key={m.l} style={{
                        background: '#F9F8F6',
                        border: '1px solid #E5E0D8',
                        borderRadius: 8,
                        padding: '14px 16px',
                      }}>
                        <div style={{ color: m.c, fontWeight: 700, fontSize: 18, fontFamily: "'JetBrains Mono', monospace" }}>{m.v}</div>
                        <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Dependents */}
                  {selectedNode.dependents.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: '#14B8A6', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                        Imported by ({selectedNode.indegree})
                      </div>
                      {selectedNode.dependents.slice(0, 8).map(d => (
                        <div
                          key={d}
                          onClick={() => {
                            const n = data?.graph.nodes.find(x => x.id === d);
                            if (n) handleNodeClick(n);
                          }}
                          style={{
                            fontSize: 12,
                            fontFamily: "'JetBrains Mono', monospace",
                            color: '#374151',
                            padding: '5px 0',
                            borderBottom: '1px solid #E5E0D8',
                            wordBreak: 'break-all',
                            cursor: 'pointer',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
                        >
                          {d}
                        </div>
                      ))}
                      {selectedNode.indegree > 8 && (
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>
                          +{selectedNode.indegree - 8} more
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dependencies */}
                  {selectedNode.dependencies.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: '#60A5FA', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase' }}>
                        Imports ({selectedNode.outdegree})
                      </div>
                      {selectedNode.dependencies.slice(0, 8).map(d => (
                        <div
                          key={d}
                          onClick={() => {
                            const n = data?.graph.nodes.find(x => x.id === d);
                            if (n) handleNodeClick(n);
                          }}
                          style={{
                            fontSize: 12,
                            fontFamily: "'JetBrains Mono', monospace",
                            color: '#374151',
                            padding: '5px 0',
                            borderBottom: '1px solid #E5E0D8',
                            wordBreak: 'break-all',
                            cursor: 'pointer',
                            transition: 'color 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#111827')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#374151')}
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Orphan warning */}
                  {selectedNode.is_orphan && (
                    <div style={{
                      background: '#FFF1F0',
                      border: '1px solid #FECACA',
                      borderRadius: 8,
                      padding: '14px 16px',
                      marginBottom: 20,
                      fontSize: 13,
                      color: '#B91C1C',
                      lineHeight: 1.7,
                    }}>
                      ⚠ This file has no connections. It's not imported by anything, and it doesn't import anything.
                      It may be unused, a standalone script, or a missed dependency.
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                    <button
                      onClick={runBlast}
                      disabled={blastLoading}
                      title="See which files would break if this file was deleted/changed"
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        background: blastLoading ? '#F0ECE4' : '#FEF2F2',
                        border: '1px solid #FECACA',
                        color: blastLoading ? '#9CA3AF' : '#EF4444',
                        borderRadius: 8,
                        cursor: blastLoading ? 'default' : 'pointer',
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        letterSpacing: '0.04em',
                        transition: 'all 0.15s',
                      }}
                    >
                      {blastLoading ? 'LOADING...' : '◉ BLAST RADIUS'}
                    </button>
                    <a
                      href={`https://github.com/${data?.meta.owner}/${data?.meta.repo}/blob/HEAD/${selectedNode.path}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        padding: '12px 0',
                        background: '#F9F8F6',
                        border: '1px solid #D1CEC8',
                        color: '#4B5563',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontFamily: 'inherit',
                        letterSpacing: '0.04em',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#F59E0B')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = '#D1CEC8')}
                    >
                      ↗ VIEW ON GITHUB
                    </a>
                  </div>

                  {/* Quick AI questions */}
                  <div style={{ fontSize: 11, color: '#9CA3AF', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 700, textTransform: 'uppercase' }}>
                    Quick Questions
                  </div>
                  {[
                    selectedNode.is_orphan ? 'Is this file safe to delete?' : null,
                    selectedNode.is_hub ? 'What would break if this file changed?' : null,
                    `What does ${selectedNode.name} do?`,
                    selectedNode.indegree > 0 ? `Why does everything import ${selectedNode.name}?` : null,
                    'Suggest improvements to this file',
                  ].filter(Boolean).slice(0, 4).map(q => (
                    <button
                      key={q!}
                      onClick={() => handleAsk(q!)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: '#F9F8F6',
                        border: '1px solid #D1CEC8',
                        color: '#4B5563',
                        padding: '10px 14px',
                        borderRadius: 8,
                        fontFamily: 'inherit',
                        fontSize: 13,
                        cursor: 'pointer',
                        marginBottom: 6,
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#14B8A6';
                        (e.currentTarget as HTMLElement).style.color = '#111827';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#D1CEC8';
                        (e.currentTarget as HTMLElement).style.color = '#4B5563';
                      }}
                    >
                      → {q}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── AI TAB ─────────────────────────────────────────────────── */}
          {sidebarTab === 'ai' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20 }}>
              {!selectedNode ? (
                <div style={{ paddingTop: 60, textAlign: 'center', fontSize: 14, color: '#9CA3AF' }}>
                  Select a node first, then ask about it
                </div>
              ) : (
                <>
                  <div style={{
                    fontSize: 13,
                    color: '#9CA3AF',
                    marginBottom: 16,
                    paddingBottom: 14,
                    borderBottom: '1px solid #E5E0D8',
                  }}>
                    Context:{' '}
                    <span style={{ color: ROLES[selectedNode.role].color, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {selectedNode.name}
                    </span>
                    {' '}· ↑{selectedNode.indegree} ↓{selectedNode.outdegree}
                  </div>

                  <textarea
                    value={aiQuestion}
                    onChange={e => setAiQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleAsk(); }}
                    placeholder={`What does ${selectedNode.name} do?\nWhat would break if I deleted this?\nWhy does X import this?\n\n⌘↵ to send`}
                    rows={4}
                    style={{
                      background: '#F9F8F6',
                      border: '1px solid #D1CEC8',
                      color: '#111827',
                      padding: '14px',
                      borderRadius: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 13,
                      resize: 'none',
                      outline: 'none',
                      marginBottom: 12,
                      lineHeight: 1.6,
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                    onFocus={e => {
                      e.target.style.borderColor = '#14B8A6';
                      e.target.style.boxShadow = '0 0 0 2px rgba(20,184,166,0.15)';
                    }}
                    onBlur={e => {
                      e.target.style.borderColor = '#D1CEC8';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    onClick={() => handleAsk()}
                    disabled={aiLoading || !aiQuestion.trim()}
                    style={{
                      background: aiLoading || !aiQuestion.trim() ? '#E5E0D8' : '#14B8A6',
                      color: aiLoading || !aiQuestion.trim() ? '#9CA3AF' : '#FFFFFF',
                      border: 'none',
                      padding: '14px',
                      borderRadius: 10,
                      fontFamily: 'inherit',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: aiLoading || !aiQuestion.trim() ? 'default' : 'pointer',
                      letterSpacing: '0.04em',
                      marginBottom: 18,
                      transition: 'all 0.15s',
                    }}
                  >
                    {aiLoading ? 'THINKING...' : 'ASK LLAMA 3.3 →'}
                  </button>

                  {aiAnswer && (
                    <div style={{
                      flex: 1,
                      overflowY: 'auto',
                      background: '#F9F8F6',
                      border: '1px solid #E5E0D8',
                      borderRadius: 10,
                      padding: 16,
                      fontSize: 13,
                      color: '#1F2937',
                      lineHeight: 1.8,
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {aiAnswer}
                    </div>
                  )}

                  {!aiAnswer && !aiLoading && (
                    <div style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 20 }}>
                      Powered by Llama 3.3 70B via Groq (free)
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── SUMMARY TAB ────────────────────────────────────────────── */}
          {sidebarTab === 'summary' && data && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {/* Project header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginBottom: 6 }}>
                  {data.summary.project_name}
                </div>
                <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 18, lineHeight: 1.5 }}>
                  {data.summary.tagline}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                  <span style={{
                    padding: '6px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    background: data.summary.complexity === 'high'
                      ? '#FEF2F2'
                      : data.summary.complexity === 'medium'
                        ? '#FFF8EB'
                        : '#F0FFF0',
                    border: `1px solid ${
                      data.summary.complexity === 'high'
                        ? '#FECACA'
                        : data.summary.complexity === 'medium'
                          ? '#FDE68A'
                          : '#BBF7D0'
                    }`,
                    color: data.summary.complexity === 'high'
                      ? '#B91C1C'
                      : data.summary.complexity === 'medium'
                        ? '#92400E'
                        : '#065F46',
                  }}>
                    {(data.summary.complexity || 'unknown').toUpperCase()} COMPLEXITY
                  </span>
                  {data.summary.architecture && (
                    <span style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      fontSize: 12,
                      background: '#F9F8F6',
                      border: '1px solid #D1CEC8',
                      color: '#4B5563',
                      fontWeight: 600,
                    }}>
                      {data.summary.architecture}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 14, color: '#4B5563', lineHeight: 1.7, margin: 0 }}>
                  {data.summary.description}
                </p>

                {/* README generation */}
                <div style={{ marginTop: 24 }}>
                  <button
                    onClick={generateReadme}
                    disabled={readmeLoading}
                    style={{
                      width: '100%',
                      padding: '10px 0',
                      background: readmeLoading ? '#E5E0D8' : '#F9F8F6',
                      border: '1px solid #D1CEC8',
                      color: readmeLoading ? '#9CA3AF' : '#B45309',
                      borderRadius: 8,
                      cursor: readmeLoading ? 'default' : 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      letterSpacing: '0.04em',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!readmeLoading) (e.currentTarget as HTMLElement).style.borderColor = '#F59E0B'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#D1CEC8'; }}
                  >
                    {readmeLoading ? 'WRITING README...' : '✨ GENERATE README'}
                  </button>
                </div>

                {readme && (
                  <div style={{ marginTop: 24 }}>
                    <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 10, textTransform: 'uppercase' }}>
                      Generated README
                    </div>
                    <div style={{
                      background: '#F9F8F6',
                      border: '1px solid #E5E0D8',
                      borderRadius: 10,
                      padding: 16,
                      fontSize: 13,
                      lineHeight: 1.7,
                      color: '#1F2937',
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'JetBrains Mono', monospace",
                      maxHeight: 400,
                      overflowY: 'auto',
                    }}>
                      {readme}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        onClick={() => navigator.clipboard.writeText(readme)}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          background: '#FFFFFF',
                          border: '1px solid #D1CEC8',
                          color: '#4B5563',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontFamily: 'inherit',
                        }}
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => {
                          const blob = new Blob([readme], { type: 'text/markdown' });
                          const a = document.createElement('a');
                          a.href = URL.createObjectURL(blob);
                          a.download = 'README.md';
                          a.click();
                        }}
                        style={{
                          flex: 1,
                          padding: '8px 0',
                          background: '#FFFFFF',
                          border: '1px solid #D1CEC8',
                          color: '#4B5563',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontFamily: 'inherit',
                        }}
                      >
                        ⬇ Download .md
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: '#E5E0D8', marginBottom: 20 }} />

              {/* Tech stack */}
              {data.summary.tech_stack?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
                    Tech Stack
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {data.summary.tech_stack.map(t => (
                      <span key={t} style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        fontSize: 13,
                        background: '#F9F8F6',
                        border: '1px solid #E5E0D8',
                        color: '#374151',
                        fontWeight: 500,
                      }}>{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Language breakdown */}
              {Object.keys(data.stats.languages).length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
                    Languages
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Object.entries(data.stats.languages)
                      .filter(([l]) => l !== 'other')
                      .slice(0, 6)
                      .map(([lang, count]) => {
                        const total = data.stats.total_files;
                        const pct = Math.round((count / total) * 100);
                        return (
                          <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 13, color: '#4B5563', width: 80, flexShrink: 0 }}>{lang}</span>
                            <div style={{ flex: 1, height: 6, background: '#E5E0D8', borderRadius: 3 }}>
                              <div style={{
                                height: '100%',
                                borderRadius: 3,
                                width: `${pct}%`,
                                background: LANG_COLOR[lang] || '#9CA3AF',
                                maxWidth: '100%',
                              }} />
                            </div>
                            <span style={{ fontSize: 12, color: '#9CA3AF', width: 30, textAlign: 'right' }}>{count}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Insights */}
              {data.summary.insights?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
                    AI Insights
                  </div>
                  {data.summary.insights.map((ins, i) => (
                    <div key={i} style={{
                      background: '#F9F8F6',
                      border: '1px solid #E5E0D8',
                      borderRadius: 10,
                      padding: '14px 16px',
                      marginBottom: 8,
                      fontSize: 13,
                      color: '#374151',
                      lineHeight: 1.7,
                      borderLeft: `3px solid ${['#F59E0B', '#EF4444', '#14B8A6'][i % 3]}`,
                    }}>
                      {ins}
                    </div>
                  ))}
                </div>
              )}

              {/* Key modules */}
              {data.summary.key_modules?.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>
                    Key Modules
                  </div>
                  {data.summary.key_modules.slice(0, 5).map((mod, i) => {
                    const [path, desc] = mod.includes(':') ? mod.split(/:(.+)/) : [mod, ''];
                    return (
                      <div key={i} style={{
                        padding: '14px 16px',
                        marginBottom: 8,
                        background: '#F9F8F6',
                        borderRadius: 10,
                        border: '1px solid #E5E0D8',
                      }}>
                        <div style={{ fontSize: 14, color: '#111827', marginBottom: 4, wordBreak: 'break-all', fontFamily: "'JetBrains Mono', monospace" }}>{path.trim()}</div>
                        {desc && <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.5 }}>{desc.trim()}</div>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Meta */}
              <div style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 2 }}>
                <div>{data.stats.total_files} files · {data.stats.total_edges} dependency edges</div>
                <div>{data.meta.files_fetched_for_deps} files parsed for dependencies</div>
                {data.meta.truncated && (
                  <div style={{ color: '#92400E', marginTop: 6 }}>
                    ⚠ GitHub truncated the tree — very large repo
                  </div>
                )}
                <a
                  href={data.meta.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#6B7280', textDecoration: 'none', fontWeight: 500 }}
                >
                  ↗ {data.meta.owner}/{data.meta.repo}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Language color map for bar chart
const LANG_COLOR: Record<string, string> = {
  python: '#3776AB', javascript: '#F7DF1E', typescript: '#3178C6',
  go: '#00ADD8', rust: '#CE422B', ruby: '#CC342D', php: '#777BB4',
  java: '#007396', csharp: '#239120', swift: '#FA7343', kotlin: '#7F52FF',
  css: '#264DE4', scss: '#CC6699', html: '#E34F26', shell: '#89E051',
  markdown: '#083FA1', json: '#9CA3AF', yaml: '#CB171E',
};