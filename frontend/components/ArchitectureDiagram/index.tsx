'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { T } from '../../theme';
import { ArchResult, ArchGraph, ArchGraphNode, ArchGraphEdge, ArchGraphGroup } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArchCanvasProps {
  arch: ArchResult;
  repoUrl: string;
  onClose: () => void;
  analysisNodes?: AnalysisNode[];
}

// Shape of a node returned by /analyze (graph.nodes)
interface AnalysisNode {
  id: string;
  name: string;
  path: string;
  dir: string;
  language: string;
  lang_color: string;
  extension: string;
  size: number;
  role: 'entry' | 'hub' | 'shared' | 'leaf' | 'orphan' | 'config';
  indegree: number;
  outdegree: number;
  dependents: string[];
  dependencies: string[];
  is_orphan: boolean;
  is_entry: boolean;
  is_hub: boolean;
  is_config: boolean;
}

type ViewMode = 'diagram' | 'explanation' | 'files';
type ExplainSection = { heading: string; body: string };
type SortKey = 'name' | 'role' | 'connections' | 'layer' | 'language';
type SortDir = 'asc' | 'desc';

// ─── Internal layout types ────────────────────────────────────────────────────

interface DiagramNode {
  id: string; label: string; sublabel: string; layer: string;
  x: number; y: number; w: number; h: number;
}
interface DiagramEdge {
  from: string; to: string; label: string;
  style: 'solid' | 'dashed' | 'thick';
}
interface DiagramData {
  nodes: DiagramNode[]; edges: DiagramEdge[];
  layers: { id: string; label: string; y: number; h: number }[];
  width: number; height: number;
}

// ─── Palette ──────────────────────────────────────────────────────────────────

const PALETTE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  default: { bg: '#fcfcfc', border: '#e5e5e5', text: '#111111', label: '#555555' },
};

const LAYER_ORDER = ['frontend','api','services','models','data','utils','infra','config','tests'];

const NODE_W        = 156;
const NODE_H        = 60;
const H_GAP         = 28;
const V_GAP         = 64;
const LAYER_PAD_TOP = 44;
const LAYER_PAD_BOT = 28;
const CANVAS_SIDE   = 36;
const MAX_COLS      = 4;

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  entry:  { label: 'Entry',   color: '#0C7D4B', bg: '#E6F5EE', icon: '⬛', desc: 'Execution starts here'    },
  hub:    { label: 'Hub',     color: '#7C3AED', bg: '#F0EBFF', icon: '⬛', desc: 'Imported by many files'    },
  shared: { label: 'Shared',  color: '#0369A1', bg: '#E0F2FE', icon: '⬛', desc: 'Used by multiple files'    },
  leaf:   { label: 'Leaf',    color: '#555555', bg: '#F5F5F5', icon: '⬛', desc: 'Imported by no other file' },
  orphan: { label: 'Orphan',  color: '#B45309', bg: '#FFF7ED', icon: '⬛', desc: 'No connections at all'     },
  config: { label: 'Config',  color: '#374151', bg: '#F3F4F6', icon: '⬛', desc: 'Configuration file'        },
};

const LAYER_HINTS: Record<string, string[]> = {
  frontend: ['pages', 'views', 'components', 'ui', 'app', 'screens', 'layouts', 'templates'],
  api:      ['api', 'routes', 'controllers', 'handlers', 'endpoints', 'routers', 'rest', 'graphql'],
  services: ['services', 'service', 'usecases', 'use_cases', 'business', 'logic', 'domain'],
  models:   ['models', 'schemas', 'entities', 'types', 'interfaces', 'dto', 'structs'],
  data:     ['db', 'database', 'repos', 'repositories', 'store', 'storage', 'dao', 'migrations'],
  utils:    ['utils', 'helpers', 'lib', 'common', 'shared', 'core', 'pkg'],
  config:   ['config', 'settings', 'env', 'constants'],
  infra:    ['infra', 'infrastructure', 'middleware', 'auth', 'cache', 'queue', 'workers'],
  tests:    ['tests', 'test', '__tests__', 'spec', 'specs'],
};

function detectLayer(path: string): string {
  const lower = path.toLowerCase();
  for (const [layer, keywords] of Object.entries(LAYER_HINTS)) {
    for (const kw of keywords) {
      if (`/${lower}/`.includes(`/${kw}/`) || lower.startsWith(`${kw}/`)) return layer;
    }
  }
  return 'utils';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPalette(_layerName: string) { return PALETTE.default; }
function trunc(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

// ─── Layout ───────────────────────────────────────────────────────────────────

function layoutJsonGraph(graph: ArchGraph): DiagramData {
  const { nodes: gNodes, edges: gEdges, groups: gGroups } = graph;
  const groups = gGroups ?? [];
  const groupLabel: Record<string, string> = {};
  for (const g of groups) groupLabel[g.id] = g.label;

  const nodeLayer: Record<string, string> = {};
  for (const n of gNodes) {
    nodeLayer[n.id] = n.group ? (groupLabel[n.group] ?? n.group) : 'Other';
  }

  const layerBuckets: Record<string, string[]> = {};
  for (const n of gNodes) {
    const l = nodeLayer[n.id];
    if (!layerBuckets[l]) layerBuckets[l] = [];
    layerBuckets[l].push(n.id);
  }

  const allKeys = Object.keys(layerBuckets);
  const orderedLayers: string[] = [
    ...LAYER_ORDER
      .map(l => allKeys.find(k => k.toLowerCase() === l))
      .filter((k): k is string => !!k),
    ...allKeys
      .filter(k => !LAYER_ORDER.includes(k.toLowerCase()))
      .sort(),
  ];

  let canvasWidth = 400;
  for (const ids of Object.values(layerBuckets)) {
    const cols = Math.min(ids.length, MAX_COLS);
    const w = CANVAS_SIDE * 2 + cols * NODE_W + (cols - 1) * H_GAP;
    if (w > canvasWidth) canvasWidth = w;
  }

  const nodeInfo: Record<string, { label: string; sublabel: string }> = {};
  for (const n of gNodes) {
    nodeInfo[n.id] = {
      label:    trunc(n.label || n.id, 22),
      sublabel: trunc(n.type  || '',   28),
    };
  }

  const layoutNodes: DiagramNode[] = [];
  const layoutLayers: DiagramData['layers'] = [];
  let curY = 40;

  for (const layerName of orderedLayers) {
    const ids = layerBuckets[layerName] ?? [];
    const rowCount = Math.ceil(ids.length / MAX_COLS);
    const layerH = LAYER_PAD_TOP + rowCount * NODE_H + Math.max(0, rowCount - 1) * V_GAP + LAYER_PAD_BOT;
    layoutLayers.push({ id: layerName, label: layerName, y: curY, h: layerH });

    ids.forEach((id, i) => {
      const col     = i % MAX_COLS;
      const row     = Math.floor(i / MAX_COLS);
      const rowCols = Math.min(ids.length - row * MAX_COLS, MAX_COLS);
      const rowW    = rowCols * NODE_W + (rowCols - 1) * H_GAP;
      const offsetX = (canvasWidth - rowW) / 2;
      const info    = nodeInfo[id] ?? { label: id, sublabel: '' };

      layoutNodes.push({
        id,
        label:    info.label,
        sublabel: info.sublabel,
        layer:    layerName,
        x: offsetX + col * (NODE_W + H_GAP),
        y: curY + LAYER_PAD_TOP + row * (NODE_H + V_GAP),
        w: NODE_W,
        h: NODE_H,
      });
    });

    curY += layerH + 28;
  }

  const canvasHeight = curY + 40;
  const nodeIdSet    = new Set(layoutNodes.map(n => n.id));
  const layoutEdges: DiagramEdge[] = gEdges
    .filter(e => nodeIdSet.has(e.from) && nodeIdSet.has(e.to) && e.from !== e.to)
    .map(e => ({
      from:  e.from,
      to:    e.to,
      label: e.label ?? '',
      style: (e.style ?? 'solid') as 'solid' | 'dashed' | 'thick',
    }));

  return { nodes: layoutNodes, edges: layoutEdges, layers: layoutLayers, width: canvasWidth, height: canvasHeight };
}

// ─── Mermaid fallback ─────────────────────────────────────────────────────────

function parseMermaidToDiagram(src: string): DiagramData | null {
  try {
    const lines = src
      .replace(/^```mermaid\n?/gi, '').replace(/\n?```$/g, '')
      .split('\n').map(l => l.trim()).filter(Boolean);

    const layerMap: Record<string, string> = {};
    let cur = 'default';

    for (const line of lines) {
      const sg = line.match(/^subgraph\s+(.+)/);
      if (sg) { cur = sg[1].replace(/["']/g, '').trim(); continue; }
      if (line === 'end') { cur = 'default'; continue; }
      if (line.startsWith('flowchart') || line.startsWith('graph')) continue;
      const nm = line.match(/^(\w+)\s*[\[({<]/);
      if (nm) layerMap[nm[1]] = cur;
    }

    const nodeLabels: Record<string, string> = {};
    for (const line of lines) {
      const lm = line.match(/^(\w+)\s*[\[({<](.+?)[\]})>]\s*$/);
      if (lm) nodeLabels[lm[1]] = lm[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
    }

    const rawEdges: ArchGraphEdge[] = [];
    const edgeRe = /(\w+)\s*(={2,}>|--?>|-.->)\s*(?:\|([^|]+)\|)?\s*(\w+)/g;
    for (const line of lines) {
      let m: RegExpExecArray | null;
      edgeRe.lastIndex = 0;
      while ((m = edgeRe.exec(line)) !== null) {
        const [, from, arrow, label, to] = m;
        rawEdges.push({
          from, to,
          label: label?.trim() ?? '',
          style: arrow.includes('=') ? 'thick' : arrow.includes('-.-') ? 'dashed' : 'solid',
        });
      }
    }

    const allIds = Array.from(new Set([
      ...Object.keys(nodeLabels),
      ...rawEdges.flatMap(e => [e.from, e.to]),
    ]));

    const seenGroups = new Set<string>();
    const groups: ArchGraphGroup[] = [];
    for (const id of allIds) {
      const l = layerMap[id] ?? 'default';
      if (!seenGroups.has(l)) { seenGroups.add(l); groups.push({ id: l, label: l }); }
    }

    const nodes: ArchGraphNode[] = allIds.map(id => {
      const raw   = nodeLabels[id] ?? id;
      const parts = raw.split('\n');
      return {
        id,
        node:  id,
        label: parts[0] ?? id,
        type:  parts.slice(1).join(' '),
        group: layerMap[id] ?? 'default',
      };
    });

    return layoutJsonGraph({ nodes, edges: rawEdges, groups });
  } catch (err) {
    console.error('[Mermaid fallback] parse error:', err);
    return null;
  }
}

// ─── SVG diagram ──────────────────────────────────────────────────────────────

function SvgDiagram({
  data,
  activeNode,
  onNodeClick,
}: {
  data: DiagramData;
  activeNode: string | null;
  onNodeClick: (id: string) => void;
}) {
  const nodeMap = useMemo(() => {
    const m: Record<string, DiagramNode> = {};
    data.nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [data.nodes]);

  const edgePath = useCallback((from: DiagramNode, to: DiagramNode): string => {
    const fx = from.x + from.w / 2;
    const fy = from.y + from.h;
    const tx = to.x + to.w / 2;
    const ty = to.y;
    if (Math.abs(fy - ty) < NODE_H * 1.5) {
      const midX = (fx + tx) / 2;
      const bend = (tx > fx ? 1 : -1) * 40;
      return `M ${fx} ${fy} Q ${midX} ${fy + bend}, ${tx} ${ty}`;
    }
    const dy   = Math.abs(ty - fy);
    const cp1y = fy + dy * 0.45;
    const cp2y = ty - dy * 0.45;
    return `M ${fx} ${fy} C ${fx} ${cp1y}, ${tx} ${cp2y}, ${tx} ${ty}`;
  }, []);

  return (
    <svg
      viewBox={`0 0 ${data.width} ${data.height}`}
      width={data.width}
      height={data.height}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        <marker id="arr-default" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={T.borderMid} />
        </marker>
        <marker id="arr-active" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={T.text} />
        </marker>
        <marker id="arr-thick" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={T.text} />
        </marker>
        <filter id="node-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="12" floodColor="#000000" floodOpacity="0.08" />
        </filter>
      </defs>

      {data.layers.map(layer => {
        const p = getPalette(layer.label);
        return (
          <g key={layer.id}>
            <rect
              x={CANVAS_SIDE / 2} y={layer.y}
              width={data.width - CANVAS_SIDE} height={layer.h}
              rx={16} ry={16}
              fill={p.bg} stroke={p.border}
              strokeWidth={1} strokeOpacity={0.8}
            />
            <text
              x={CANVAS_SIDE} y={layer.y + 24}
              fontSize={10} fontWeight={600} fontFamily={T.mono}
              fill={p.label} letterSpacing="0.05em" textAnchor="start"
            >
              {layer.label.toUpperCase()}
            </text>
          </g>
        );
      })}

      {data.edges.map((edge, i) => {
        const from = nodeMap[edge.from];
        const to   = nodeMap[edge.to];
        if (!from || !to) return null;
        const isActive = activeNode === edge.from || activeNode === edge.to;
        const isThick  = edge.style === 'thick';
        const isDash   = edge.style === 'dashed';
        const path     = edgePath(from, to);
        const midX     = (from.x + from.w / 2 + to.x + to.w / 2) / 2;
        const midY     = (from.y + from.h + to.y) / 2;

        return (
          <g key={i} opacity={activeNode && !isActive ? 0.15 : 1} style={{ transition: 'opacity 0.2s' }}>
            <path
              d={path} fill="none"
              stroke={isThick ? T.text : isActive ? T.text : T.borderMid}
              strokeWidth={isThick ? 2 : isActive ? 1.5 : 1}
              strokeDasharray={isDash ? '5 4' : undefined}
              markerEnd={isThick ? 'url(#arr-thick)' : isActive ? 'url(#arr-active)' : 'url(#arr-default)'}
            />
            {edge.label && (
              <text
                x={midX} y={midY - 6}
                fontSize={10} fontFamily={T.sans} fontWeight={500}
                fill={isActive ? T.text : T.textDim}
                textAnchor="middle" style={{ pointerEvents: 'none' }}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {data.nodes.map(node => {
        const isActive = activeNode === node.id;
        const isDimmed = !!activeNode && !isActive;
        const p = getPalette(node.layer);

        return (
          <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onClick={() => onNodeClick(node.id)}
            style={{ cursor: 'pointer' }}
            opacity={isDimmed ? 0.25 : 1}
          >
            {isActive && (
              <rect
                x={-4} y={-4} width={node.w + 8} height={node.h + 8}
                rx={14} ry={14}
                fill="none" stroke={T.borderMid} strokeWidth={1}
              />
            )}
            <rect
              x={0} y={0} width={node.w} height={node.h}
              rx={10} ry={10}
              fill={T.bgSurface}
              stroke={isActive ? T.text : p.border}
              strokeWidth={isActive ? 1.5 : 1}
              filter="url(#node-glow)"
              style={{ transition: 'all 0.18s ease' }}
            />
            <rect x={0} y={0} width={4} height={node.h} rx={10} ry={10} fill={isActive ? T.text : T.borderMid} />
            <rect x={2} y={0} width={2} height={node.h} fill={isActive ? T.text : T.borderMid} />
            <text
              x={16}
              y={node.sublabel ? node.h / 2 - 7 : node.h / 2 + 1}
              fontSize={12} fontWeight={600} fontFamily={T.sans}
              fill={isActive ? T.text : p.text}
              dominantBaseline="middle"
              style={{ pointerEvents: 'none', letterSpacing: '-0.01em' }}
            >
              {node.label}
            </text>
            {node.sublabel && (
              <text
                x={16} y={node.h / 2 + 9}
                fontSize={10} fontFamily={T.sans}
                fill={p.label}
                dominantBaseline="middle"
                style={{ pointerEvents: 'none' }}
              >
                {node.sublabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Explanation panel ────────────────────────────────────────────────────────

function parseExplanation(raw: string): ExplainSection[] {
  if (!raw) return [];
  const sections: ExplainSection[] = [];
  const parts = raw.split(/\n\n(?=\*\*\d+\.)/);
  for (const part of parts) {
    const m = part.match(/^\*\*(.+?)\*\*/);
    if (m) {
      sections.push({
        heading: m[1].replace(/^\d+\.\s*/, ''),
        body: part.replace(/^\*\*.+?\*\*\n?/, '').trim(),
      });
    } else if (part.trim()) {
      sections.push({ heading: '', body: part.trim() });
    }
  }
  return sections.length ? sections : [{ heading: '', body: raw }];
}

function ExplanationPanel({ arch }: { arch: ArchResult }) {
  const sections = parseExplanation(arch.explanation);
  return (
    <div style={{ padding: '0 24px 32px' }}>
      {sections.map((s, i) => (
        <div
          key={i}
          style={{
            marginBottom: 32, paddingBottom: 32, paddingLeft: 20,
            borderBottom: i < sections.length - 1 ? `1px solid ${T.border}` : 'none',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
            background: T.borderHi, borderRadius: 2,
          }} />
          {s.heading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 100,
                background: T.bgHover, color: T.text, border: `1px solid ${T.border}`,
                fontFamily: T.sans, letterSpacing: '0.02em',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: '-0.01em' }}>
                {s.heading}
              </span>
            </div>
          )}
          <p style={{
            fontSize: 14, color: T.textMuted, lineHeight: 1.6,
            margin: 0, whiteSpace: 'pre-wrap', fontFamily: T.sans,
          }}>
            {s.body}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Files view ───────────────────────────────────────────────────────────────

// Grid template shared between header and rows — keep in sync
const FILES_GRID = '1fr 80px 76px 96px 72px';

function FilesView({ nodes }: { nodes: AnalysisNode[] }) {
  const [search, setSearch]         = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [layerFilter, setLayerFilter] = useState<string>('all');
  const [sortKey, setSortKey]       = useState<SortKey>('connections');
  const [sortDir, setSortDir]       = useState<SortDir>('desc');
  const [expanded, setExpanded]     = useState<string | null>(null);

  const enriched = useMemo(() =>
    nodes.map(n => ({ ...n, layer: detectLayer(n.path) })),
    [nodes],
  );

  const allLayers = useMemo(() =>
    Array.from(new Set(enriched.map(n => n.layer))).sort(),
    [enriched],
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        n.path.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q) ||
        n.language.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== 'all')  list = list.filter(n => n.role  === roleFilter);
    if (layerFilter !== 'all') list = list.filter(n => n.layer === layerFilter);

    return [...list].sort((a, b) => {
      let av: string | number = 0;
      let bv: string | number = 0;
      if (sortKey === 'name')        { av = a.name.toLowerCase();            bv = b.name.toLowerCase(); }
      if (sortKey === 'role')        { av = a.role;                          bv = b.role; }
      if (sortKey === 'connections') { av = a.indegree + a.outdegree;        bv = b.indegree + b.outdegree; }
      if (sortKey === 'layer')       { av = (a as any).layer;                bv = (b as any).layer; }
      if (sortKey === 'language')    { av = a.language;                      bv = b.language; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [enriched, search, roleFilter, layerFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const roleCounts = useMemo(() => {
    const m: Record<string, number> = {};
    enriched.forEach(n => { m[n.role] = (m[n.role] ?? 0) + 1; });
    return m;
  }, [enriched]);

  const handleRowClick = useCallback((id: string) => {
    setExpanded(prev => prev === id ? null : id);
  }, []);

  return (
    // position:absolute fill — parent is position:relative with flex:1
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Role filter chips ── */}
      <div style={{
        padding: '10px 20px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0,
        backgroundColor: T.bgElevated,
      }}>
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const count = roleCounts[role] ?? 0;
          if (!count) return null;
          const active = roleFilter === role;
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(active ? 'all' : role)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 100,
                border: `1px solid ${active ? cfg.color : T.border}`,
                background: active ? cfg.bg : T.bgSurface,
                cursor: 'pointer', fontSize: 11, fontWeight: 600,
                color: active ? cfg.color : T.textDim,
                fontFamily: T.sans, transition: 'all 0.12s',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
              {cfg.label}
              <span style={{
                background: active ? cfg.color : T.bgHover,
                color: active ? '#fff' : T.text,
                borderRadius: 100, padding: '1px 6px', fontSize: 10, fontWeight: 700,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Search + layer filter ── */}
      <div style={{
        padding: '8px 20px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
      }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: T.bgSurface, border: `1px solid ${T.border}`,
          borderRadius: 8, padding: '6px 10px',
        }}>
          <i className="ti ti-search" style={{ fontSize: 13, color: T.textDim, pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, path, or language…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 12, fontFamily: T.sans, color: T.text,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, lineHeight: 1, padding: 2 }}
            >
              <i className="ti ti-x" style={{ fontSize: 12 }} />
            </button>
          )}
        </div>

        <select
          value={layerFilter}
          onChange={e => setLayerFilter(e.target.value)}
          style={{
            background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8,
            padding: '6px 10px', fontSize: 12, fontFamily: T.sans, color: T.text,
            cursor: 'pointer', outline: 'none', flexShrink: 0,
          }}
        >
          <option value="all">All layers</option>
          {allLayers.map(l => (
            <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
          ))}
        </select>

        <span style={{ fontSize: 11, color: T.textDim, fontFamily: T.sans, flexShrink: 0, fontWeight: 500 }}>
          {filtered.length} / {nodes.length}
        </span>
      </div>

      {/* ── Column headers ── */}
      <div style={{
        display: 'grid', gridTemplateColumns: FILES_GRID,
        padding: '5px 20px', borderBottom: `1px solid ${T.border}`,
        flexShrink: 0, backgroundColor: T.bgElevated,
      }}>
        {([
          ['name',        'File'],
          ['layer',       'Layer'],
          ['role',        'Role'],
          ['connections', 'Deps'],
          ['language',    'Lang'],
        ] as [SortKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => toggleSort(key)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              fontSize: 10, fontWeight: 700, color: sortKey === key ? T.text : T.textDim,
              fontFamily: T.sans, letterSpacing: '0.04em', textTransform: 'uppercase',
              padding: '3px 0', display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            {label}
            {sortKey === key && <span style={{ fontSize: 9 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
          </button>
        ))}
      </div>

      {/* ── Scrollable file list ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: T.textDim, fontSize: 13, fontFamily: T.sans }}>
            No files match your filters.
          </div>
        ) : filtered.map(node => {
          const role   = ROLE_CONFIG[node.role] ?? ROLE_CONFIG.leaf;
          const isOpen = expanded === node.id;
          const conns  = node.indegree + node.outdegree;
          const layer  = (node as any).layer as string;

          return (
            <div key={node.id} style={{ borderBottom: `1px solid ${T.border}` }}>

              {/* ── Row — button for reliable click ── */}
              <button
                onClick={() => handleRowClick(node.id)}
                style={{
                  display: 'grid', gridTemplateColumns: FILES_GRID,
                  width: '100%', padding: '9px 20px',
                  background: isOpen ? T.bgHover : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  alignItems: 'center', transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = T.bgHover; }}
                onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* File name + dir */}
                <div style={{ minWidth: 0, paddingRight: 12 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: T.text, fontFamily: T.mono,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    textAlign: 'left',
                  }}>
                    {node.name}
                  </div>
                  {node.dir && node.dir !== '/' && (
                    <div style={{
                      fontSize: 10, color: T.textDim, fontFamily: T.mono, marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textAlign: 'left',
                    }}>
                      {node.dir}
                    </div>
                  )}
                </div>

                {/* Layer */}
                <div style={{
                  fontSize: 10, color: T.textDim, fontFamily: T.sans, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  textAlign: 'left',
                }}>
                  {layer}
                </div>

                {/* Role badge */}
                <div style={{ textAlign: 'left' }}>
                  <span style={{
                    display: 'inline-block',
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
                    color: role.color, background: role.bg, fontFamily: T.sans,
                  }}>
                    {role.label}
                  </span>
                </div>

                {/* Connection bar + count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 32, height: 4, borderRadius: 2,
                    background: T.border, overflow: 'hidden', flexShrink: 0,
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${Math.min(100, conns * 8)}%`,
                      background: conns > 8 ? '#7C3AED' : conns > 3 ? '#0369A1' : T.borderMid,
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: T.text, fontFamily: T.sans, fontWeight: 600, minWidth: 16, textAlign: 'left' }}>
                    {conns}
                  </span>
                </div>

                {/* Language */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: node.lang_color || T.borderMid,
                  }} />
                  <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.sans }}>
                    {node.language === 'other' ? node.extension : node.language.slice(0, 5)}
                  </span>
                </div>
              </button>

              {/* ── Expanded detail ── */}
              {isOpen && (
                <div style={{
                  padding: '16px 20px 20px',
                  backgroundColor: T.bgHover,
                  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20,
                }}>
                  {/* Left: file metadata */}
                  <div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: T.textDim,
                      letterSpacing: '0.05em', textTransform: 'uppercase',
                      marginBottom: 10, fontFamily: T.sans,
                    }}>
                      File info
                    </div>
                    <InfoRow label="Full path"   value={node.path} mono />
                    <InfoRow label="Role"        value={`${role.label} — ${role.desc}`} />
                    <InfoRow label="Layer"       value={layer} />
                    <InfoRow label="Language"    value={node.language} />
                    <InfoRow label="Size"        value={node.size ? `${(node.size / 1024).toFixed(1)} KB` : '—'} />
                    <InfoRow label="Imported by" value={`${node.indegree} file${node.indegree !== 1 ? 's' : ''}`} />
                    <InfoRow label="Imports"     value={`${node.outdegree} file${node.outdegree !== 1 ? 's' : ''}`} />
                  </div>

                  {/* Right: dependency lists */}
                  <div>
                    {node.dependents.length > 0 && (
                      <div style={{ marginBottom: 14 }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: T.textDim,
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                          marginBottom: 8, fontFamily: T.sans,
                        }}>
                          Imported by ({node.dependents.length})
                        </div>
                        {node.dependents.slice(0, 8).map(dep => (
                          <div key={dep} style={{
                            fontSize: 11, fontFamily: T.mono, color: T.text,
                            padding: '4px 0', borderBottom: `1px solid ${T.border}`,
                            display: 'flex', gap: 6, alignItems: 'baseline',
                          }}>
                            <span style={{ color: T.textDim, flexShrink: 0 }}>←</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dep}
                            </span>
                          </div>
                        ))}
                        {node.dependents.length > 8 && (
                          <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.sans, marginTop: 4 }}>
                            +{node.dependents.length - 8} more
                          </div>
                        )}
                      </div>
                    )}

                    {node.dependencies.length > 0 && (
                      <div>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: T.textDim,
                          letterSpacing: '0.05em', textTransform: 'uppercase',
                          marginBottom: 8, fontFamily: T.sans,
                        }}>
                          Imports ({node.dependencies.length})
                        </div>
                        {node.dependencies.slice(0, 8).map(dep => (
                          <div key={dep} style={{
                            fontSize: 11, fontFamily: T.mono, color: T.text,
                            padding: '4px 0', borderBottom: `1px solid ${T.border}`,
                            display: 'flex', gap: 6, alignItems: 'baseline',
                          }}>
                            <span style={{ color: T.textDim, flexShrink: 0 }}>→</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dep}
                            </span>
                          </div>
                        ))}
                        {node.dependencies.length > 8 && (
                          <div style={{ fontSize: 10, color: T.textDim, fontFamily: T.sans, marginTop: 4 }}>
                            +{node.dependencies.length - 8} more
                          </div>
                        )}
                      </div>
                    )}

                    {node.dependents.length === 0 && node.dependencies.length === 0 && (
                      <div style={{ fontSize: 12, color: T.textDim, fontFamily: T.sans, paddingTop: 4 }}>
                        No dependency connections.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 5, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 10, fontWeight: 600, color: T.textDim, fontFamily: T.sans,
        minWidth: 72, flexShrink: 0, paddingTop: 1,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, color: T.text,
        fontFamily: mono ? T.mono : T.sans,
        overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArchitectureDiagram({ arch, repoUrl, onClose, analysisNodes }: ArchCanvasProps) {
  const [view, setView]             = useState<ViewMode>('diagram');
  const [zoom, setZoom]             = useState(1);
  const [copied, setCopied]         = useState(false);
  const [activeNode, setActiveNode] = useState<string | null>(null);

  const hasFiles = !!analysisNodes && analysisNodes.length > 0;

  useEffect(() => {
    const hasGraph   = (arch.graph?.nodes?.length ?? 0) > 0;
    const hasMermaid = !!arch.mermaid;
    if (!hasGraph && !hasMermaid && view === 'diagram') {
      setView(hasFiles ? 'files' : 'explanation');
    }
  }, [arch, view, hasFiles]);

  const diagramData = useMemo<DiagramData | null>(() => {
    const nodes = arch.graph?.nodes;
    if (nodes && nodes.length > 0) {
      try { return layoutJsonGraph(arch.graph as ArchGraph); }
      catch (e) { console.error('JSON graph layout error:', e); }
    }
    if (arch.mermaid) return parseMermaidToDiagram(arch.mermaid);
    return null;
  }, [arch]);

  const hasDiagram = !!diagramData && diagramData.nodes.length > 0;
  const nodeCount  = diagramData?.nodes.length ?? 0;
  const edgeCount  = diagramData?.edges.length ?? 0;

  const activeNodeData = useMemo(
    () => diagramData?.nodes.find(n => n.id === activeNode) ?? null,
    [diagramData, activeNode],
  );

  const connectedEdges = useMemo(
    () => diagramData?.edges.filter(e => e.from === activeNode || e.to === activeNode) ?? [],
    [diagramData, activeNode],
  );

  const repoName  = repoUrl.replace(/https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const repoShort = repoName.split('/')[1] ?? repoName;

  const handleCopy = useCallback(() => {
    const txt = arch.mermaid ?? JSON.stringify(arch.graph, null, 2) ?? '';
    navigator.clipboard.writeText(txt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [arch]);

  const handleExport = useCallback(() => {
    const svgEl = document.querySelector('.arch-svg-wrap svg') as SVGElement | null;
    if (!svgEl) return;
    const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), {
      href: url, download: `${repoShort}-architecture.svg`,
    }).click();
    URL.revokeObjectURL(url);
  }, [repoShort]);

  const zoomIn    = useCallback(() => setZoom(z => Math.min(2.5,  parseFloat((z + 0.15).toFixed(2)))), []);
  const zoomOut   = useCallback(() => setZoom(z => Math.max(0.25, parseFloat((z - 0.15).toFixed(2)))), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  const tabs: { id: ViewMode; label: string; disabled?: boolean }[] = [
    { id: 'diagram',     label: 'Diagram',     disabled: !hasDiagram },
    { id: 'files',       label: 'Files',       disabled: !hasFiles   },
    { id: 'explanation', label: 'Explanation'                        },
  ];

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'row',
        background: T.bg, fontFamily: T.sans,
      }}
    >
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .arch-left {
          width: 320px; flex-shrink: 0;
          background: ${T.bgElevated}; border-right: 1px solid ${T.border};
          display: flex; flex-direction: column; z-index: 10;
        }
        .arch-center {
          flex: 1; display: flex; flex-direction: column; min-width: 0;
        }
        .arch-row:hover { background: ${T.bgHover} !important; }
        .arch-tab-btn { transition: color 0.12s, border-color 0.12s; }
        .arch-tab-btn:hover { color: ${T.text} !important; }
        .files-search input::placeholder { color: ${T.textDim}; }

        @media (max-width: 900px) {
          .arch-left {
            position: absolute; left: 0; top: 0; bottom: 0; z-index: 20;
            transform: translateX(-100%); transition: transform 0.25s ease;
            box-shadow: 4px 0 24px rgba(0,0,0,0.08);
          }
          .arch-left.open { transform: translateX(0); }
          .arch-center { width: 100%; }
        }
      `}</style>

      {/* ── LEFT RAIL ───────────────────────────────────────────────────── */}
      <div className="arch-left">

        {/* Repo + title header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <i className="ti ti-brand-github" style={{ fontSize: 14, color: T.textDim }} />
            <span style={{ fontSize: 12, fontFamily: T.sans, fontWeight: 500, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {repoName}
            </span>
          </div>

          <div style={{
            fontSize: 16, fontWeight: 700, color: T.text,
            lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.02em',
          }}>
            {arch.title || `${repoShort} Architecture`}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hasDiagram && (
              <>
                <Chip label={`${nodeCount} nodes`} />
                <Chip label={`${edgeCount} edges`} />
              </>
            )}
            {hasFiles && <Chip label={`${analysisNodes!.length} files`} />}
            {arch.explanation && (
              <Chip label={`${parseExplanation(arch.explanation).length} sections`} />
            )}
          </div>
        </div>

        {/* View tabs — now 3 */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className="arch-tab-btn"
              onClick={() => setView(tab.id)}
              disabled={tab.disabled}
              style={{
                flex: 1, height: 44, background: 'none', border: 'none',
                borderBottom: `2px solid ${view === tab.id ? T.text : 'transparent'}`,
                color: view === tab.id ? T.text : T.textDim,
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                fontSize: 11, fontFamily: T.sans, fontWeight: 600,
                letterSpacing: '0.02em', textTransform: 'capitalize',
                opacity: tab.disabled ? 0.3 : 1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rail body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'explanation' ? (
            <div style={{ paddingTop: 24 }}>
              <ExplanationPanel arch={arch} />
            </div>

          ) : view === 'files' && hasFiles ? (
            // Files view in the rail just shows a hint — full view is in center
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 16 }}>
                Browse every file with its role, layer, and dependency connections.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                  <div key={role} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px', borderRadius: 8,
                    background: T.bgSurface, border: `1px solid ${T.border}`,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: cfg.color, flexShrink: 0, marginTop: 3,
                    }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text, fontFamily: T.sans }}>
                        {cfg.label}
                      </div>
                      <div style={{ fontSize: 11, color: T.textDim, fontFamily: T.sans, marginTop: 2 }}>
                        {cfg.desc}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          ) : hasDiagram && view === 'diagram' ? (
            <div style={{ padding: '20px' }}>
              {activeNodeData ? (
                <div style={{ animation: 'fadeUp 0.18s ease' }}>
                  <SLabel>Selected node</SLabel>
                  {(() => {
                    return (
                      <div style={{
                        background: T.bgSurface, border: `1px solid ${T.border}`,
                        borderRadius: 12, padding: '16px', marginBottom: 20,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 4 }}>
                          {activeNodeData.label}
                        </div>
                        {activeNodeData.sublabel && (
                          <div style={{ fontSize: 12, color: T.textDim, fontFamily: T.sans, marginBottom: 12 }}>
                            {activeNodeData.sublabel}
                          </div>
                        )}
                        <span style={{
                          fontSize: 10, fontFamily: T.sans,
                          color: T.text, background: T.bgHover,
                          border: `1px solid ${T.border}`,
                          padding: '4px 10px', borderRadius: 100,
                          fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>
                          {activeNodeData.layer}
                        </span>
                      </div>
                    );
                  })()}

                  {connectedEdges.length > 0 && (
                    <>
                      <SLabel>Connections ({connectedEdges.length})</SLabel>
                      {connectedEdges.slice(0, 12).map((e, i) => {
                        const isOut = e.from === activeNode;
                        return (
                          <div
                            key={i}
                            className="arch-row"
                            onClick={() => setActiveNode(isOut ? e.to : e.from)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 10px', borderRadius: 8,
                              cursor: 'pointer', marginBottom: 4,
                              transition: 'background 0.1s',
                              border: `1px solid ${T.border}`,
                              background: T.bgSurface
                            }}
                          >
                            <span style={{ fontSize: 12, fontWeight: 700, width: 14, textAlign: 'center', flexShrink: 0, color: T.text }}>
                              {isOut ? '→' : '←'}
                            </span>
                            <span style={{
                              fontSize: 12, fontFamily: T.sans, fontWeight: 500, color: T.text,
                              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {isOut ? e.to : e.from}
                            </span>
                            {e.label && (
                              <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.sans, flexShrink: 0 }}>
                                {e.label}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  <button
                    onClick={() => setActiveNode(null)}
                    style={{
                      width: '100%', justifyContent: 'center', marginTop: 16,
                      background: T.bgSurface, border: `1px solid ${T.border}`,
                      padding: '10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                      color: T.text, cursor: 'pointer', transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
                    onMouseLeave={e => e.currentTarget.style.background = T.bgSurface}
                  >
                    Clear selection
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
                    {arch.explanation
                      ? arch.explanation.replace(/\*\*/g, '').slice(0, 150) + '…'
                      : 'Click any node in the diagram to explore its connections.'}
                  </div>

                  {arch.explanation && (
                    <button
                      onClick={() => setView('explanation')}
                      style={{
                        width: '100%', justifyContent: 'center', marginBottom: 32,
                        background: '#111', border: 'none', color: '#fff',
                        padding: '12px', borderRadius: 100, fontSize: 13, fontWeight: 600,
                        cursor: 'pointer', transition: 'opacity 0.15s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      Read full explanation →
                    </button>
                  )}

                  <SLabel>Legend</SLabel>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, background: T.bgSurface, border: `1px solid ${T.border}` }} />
                    <span style={{ fontSize: 13, color: T.textMuted, fontFamily: T.sans }}>Standard Node</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, background: T.bgSurface, border: `1px solid ${T.text}` }} />
                    <span style={{ fontSize: 13, color: T.textMuted, fontFamily: T.sans }}>Selected Node</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <i className="ti ti-sitemap" style={{ fontSize: 36, color: T.borderMid, display: 'block', marginBottom: 16 }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 8 }}>No diagram available</div>
              <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, marginBottom: 24 }}>
                Switch to Explanation to read the architecture breakdown.
              </div>
              <button
                onClick={() => setView('explanation')}
                style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 100, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Go to explanation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── CENTER PANE ─────────────────────────────────────────────────── */}
      <div className="arch-center">

        {/* Toolbar */}
        <div style={{
          height: 52, padding: '0 20px',
          borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgElevated,
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 10,
        }}>
          <span style={{ fontSize: 12, color: T.textDim, fontFamily: T.sans, fontWeight: 500, flex: 1 }}>
            {view === 'files'
              ? `${analysisNodes?.length ?? 0} files · click any row to expand`
              : hasDiagram
                ? `Architecture · ${nodeCount} nodes · ${edgeCount} edges`
                : 'Architecture Explanation'}
          </span>

          {view === 'diagram' && hasDiagram && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 2,
                backgroundColor: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8, padding: '2px 4px',
              }}>
                <TBtn onClick={zoomOut} title="Zoom out">−</TBtn>
                <span style={{ fontSize: 12, fontFamily: T.sans, fontWeight: 500, color: T.text, minWidth: 44, textAlign: 'center', userSelect: 'none' }}>
                  {Math.round(zoom * 100)}%
                </span>
                <TBtn onClick={zoomIn} title="Zoom in">+</TBtn>
                <TBtn onClick={zoomReset} title="Reset zoom">↺</TBtn>
              </div>

              <div style={{ width: 1, height: 20, backgroundColor: T.border, flexShrink: 0 }} />

              <button
                onClick={handleCopy}
                style={{
                  backgroundColor: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600, color: copied ? T.green : T.text,
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                }}
              >
                <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ fontSize: 14 }} />
                {copied ? 'Copied' : 'Copy'}
              </button>

              <button
                onClick={handleExport}
                style={{
                  backgroundColor: 'transparent', border: `1px solid ${T.border}`, borderRadius: 8,
                  padding: '6px 12px', fontSize: 12, fontWeight: 600, color: T.text,
                  display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
                }}
              >
                <i className="ti ti-download" style={{ fontSize: 14 }} /> SVG
              </button>

              <div style={{ width: 1, height: 20, backgroundColor: T.border, flexShrink: 0 }} />
            </>
          )}

          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent', border: 'none', borderRadius: 8,
              padding: '6px', color: T.textDim, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.backgroundColor = T.bgHover}
            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            title="Close"
          >
            <i className="ti ti-x" style={{ fontSize: 18 }} />
          </button>
        </div>

        {/* Canvas / content area */}
        {view === 'files' && hasFiles ? (
          <div style={{ flex: 1, position: 'relative', animation: 'fadeUp 0.22s ease' }}>
            <FilesView nodes={analysisNodes!} />
          </div>
        ) : (
          <div style={{
            flex: 1, overflow: 'auto', padding: view === 'explanation' ? 40 : 40,
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            backgroundColor: T.bgHover,
            backgroundImage: `radial-gradient(circle, ${T.borderMid} 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}>

            {view === 'explanation' ? (
              <div style={{
                maxWidth: 760, width: '100%',
                background: T.bgElevated, border: `1px solid ${T.border}`,
                borderRadius: 16, padding: '48px 0',
                animation: 'fadeUp 0.22s ease',
                boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
              }}>
                <div style={{ padding: '0 48px', marginBottom: 32 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: T.text, letterSpacing: '-0.025em', marginBottom: 8 }}>
                    Architecture Breakdown
                  </div>
                  <div style={{ fontSize: 14, color: T.textMuted }}>{arch.title ?? repoName}</div>
                </div>
                <div style={{ paddingLeft: 24 }}>
                  <ExplanationPanel arch={arch} />
                </div>
              </div>

            ) : !hasDiagram ? (
              <div style={{
                maxWidth: 440, textAlign: 'center',
                background: T.bgElevated, border: `1px solid ${T.border}`,
                borderRadius: 16, padding: '56px 32px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.02)'
              }}>
                <i className="ti ti-sitemap" style={{ fontSize: 48, color: T.borderMid, display: 'block', marginBottom: 24 }} />
                <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 12 }}>No diagram available</div>
                <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 32, lineHeight: 1.6 }}>
                  The architecture graph could not be generated. View the explanation instead.
                </div>
                <button
                  onClick={() => setView('explanation')}
                  style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 100, padding: '12px 24px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
                >
                  Read explanation
                </button>
              </div>

            ) : (
              <div
                className="arch-svg-wrap"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.18s cubic-bezier(0.4,0,0.2,1)',
                  animation: 'fadeUp 0.22s ease',
                }}
              >
                <SvgDiagram
                  data={diagramData!}
                  activeNode={activeNode}
                  onNodeClick={id => setActiveNode(prev => prev === id ? null : id)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Micro components ─────────────────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100,
      backgroundColor: T.bgHover, color: T.text, border: `1px solid ${T.border}`,
      fontFamily: T.sans,
    }}>
      {label}
    </span>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: T.textDim,
      textTransform: 'uppercase', letterSpacing: '0.05em',
      marginBottom: 12, fontFamily: T.sans,
    }}>
      {children}
    </div>
  );
}

function TBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 28, height: 28, borderRadius: 6, border: 'none',
        backgroundColor: 'transparent', color: T.textDim,
        cursor: 'pointer', fontSize: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: T.sans, transition: 'all 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.backgroundColor = T.bgHover; }}
      onMouseLeave={e => { e.currentTarget.style.color = T.textDim; e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      {children}
    </button>
  );
}