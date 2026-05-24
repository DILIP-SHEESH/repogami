'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { T } from '../../theme';
import { ArchResult, ArchGraph, ArchGraphNode, ArchGraphEdge, ArchGraphGroup } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArchCanvasProps {
  arch: ArchResult;
  repoUrl: string;
  onClose: () => void;
}

type ViewMode = 'diagram' | 'explanation';
type ExplainSection = { heading: string; body: string };

// ─── Internal layout types (SVG rendering only) ───────────────────────────────

interface DiagramNode {
  id: string;
  label: string;
  sublabel: string;
  layer: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DiagramEdge {
  from: string;
  to: string;
  label: string;
  style: 'solid' | 'dashed' | 'thick';
}

interface DiagramData {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  layers: { id: string; label: string; y: number; h: number }[];
  width: number;
  height: number;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const PALETTE: Record<string, { bg: string; border: string; text: string; label: string }> = {
  frontend: { bg: '#FFF7ED', border: '#FB923C', text: '#7C2D12', label: '#EA580C' },
  api:      { bg: '#EFF6FF', border: '#3B82F6', text: '#1E3A8A', label: '#2563EB' },
  services: { bg: '#F0FDF4', border: '#10B981', text: '#064E3B', label: '#059669' },
  data:     { bg: '#FDF4FF', border: '#A855F7', text: '#581C87', label: '#9333EA' },
  models:   { bg: '#F3E8FF', border: '#C084FC', text: '#4C1D95', label: '#A855F7' },
  infra:    { bg: '#FEF2F2', border: '#EF4444', text: '#7F1D1D', label: '#DC2626' },
  config:   { bg: '#FFFBEB', border: '#F59E0B', text: '#78350F', label: '#D97706' },
  utils:    { bg: '#F8FAFC', border: '#94A3B8', text: '#1E293B', label: '#64748B' },
  tests:    { bg: '#ECFDF5', border: '#14B8A6', text: '#134E4A', label: '#0D9488' },
  default:  { bg: '#F8FAFC', border: '#E5E7EB', text: '#111827', label: '#6B7280' },
};

const LAYER_ORDER = [
  'frontend', 'api', 'services', 'models', 'data', 'utils', 'infra', 'config', 'tests',
];

const SECTION_COLORS = [T.purple, T.cyan, T.green, T.pink, T.amber, T.red];

const NODE_W        = 160;
const NODE_H        = 64;
const H_GAP         = 32;
const V_GAP         = 72;
const LAYER_PAD_TOP = 48;
const LAYER_PAD_BOT = 32;
const CANVAS_SIDE   = 40;
const MAX_COLS      = 4;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPalette(layerName: string) {
  return PALETTE[layerName.toLowerCase()] ?? PALETTE.default;
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ─── Layout: JSON graph → DiagramData ────────────────────────────────────────

function layoutJsonGraph(graph: ArchGraph): DiagramData {
  const { nodes: gNodes, edges: gEdges, groups: gGroups } = graph;

  const groupLabel: Record<string, string> = {};
  for (const g of gGroups) groupLabel[g.id] = g.label; 

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

    curY += layerH + 32;
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

// ─── Legacy Mermaid fallback ──────────────────────────────────────────────────

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
      return { id, label: parts[0] ?? id, type: parts.slice(1).join(' '), group: layerMap[id] ?? 'default' };
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
          <path d="M0,0 L0,6 L8,3 z" fill={T.textDim} />
        </marker>
        <marker id="arr-active" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={T.text} /> 
        </marker>
        <marker id="arr-thick" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={T.cyan} />
        </marker>
        <filter id="shadow" x="-10%" y="-10%" width="130%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="rgba(0,0,0,0.04)" />
        </filter>
        <filter id="shadow-active" x="-15%" y="-15%" width="140%" height="150%"> 
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor={`${T.cyan}30`} />
        </filter>
      </defs>

      {/* Layer backgrounds */}
      {data.layers.map(layer => {
        const p = getPalette(layer.label);
        return ( 
          <g key={layer.id}>
            <rect
              x={CANVAS_SIDE / 2} y={layer.y}
              width={data.width - CANVAS_SIDE} height={layer.h}
              rx={16} ry={16}
              fill={p.bg} stroke={p.border}
              strokeWidth={1} strokeOpacity={0.6} opacity={0.6} 
            />
            <text
              x={CANVAS_SIDE} y={layer.y + 24}
              fontSize={10} fontWeight={700} fontFamily={T.mono}
              fill={p.label} letterSpacing="0.1em" textAnchor="start"
            >
              {layer.label.toUpperCase()} 
            </text>
          </g>
        );
      })} 

      {/* Edges */}
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
          <g key={i} opacity={activeNode && !isActive ? 0.1 : 1} style={{ transition: 'opacity 0.2s' }}>
            <path 
              d={path} fill="none"
              stroke={isThick ? T.cyan : isActive ? T.text : T.border}
              strokeWidth={isThick ? 2.5 : isActive ? 2 : 1.5}
              strokeDasharray={isDash ? '6 4' : undefined}
              markerEnd={isThick ? 'url(#arr-thick)' : isActive ? 'url(#arr-active)' : 'url(#arr-default)'} 
            />
            {edge.label && (
              <text
                x={midX} y={midY - 4}
                fontSize={9} fontFamily={T.mono} fontWeight={500}
                fill={isActive ? T.text : T.textMuted} 
                textAnchor="middle" style={{ pointerEvents: 'none' }}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })} 

      {/* Nodes */}
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
            opacity={isDimmed ? 0.2 : 1}
          >
            <rect
              x={0} y={0} width={node.w} height={node.h} rx={12} ry={12}
              fill="#FFFFFF"
              stroke={isActive ? T.text : p.border} 
              strokeWidth={isActive ? 2 : 1}
              filter={isActive ? 'url(#shadow-active)' : 'url(#shadow)'}
              style={{ transition: 'all 0.2s ease' }}
            />
            <rect
              x={0} y={0} width={6} height={node.h} rx={12} ry={12} 
              fill={isActive ? T.text : p.border} opacity={isActive ? 1 : 0.8} 
            />
            <text
              x={18}
              y={node.sublabel ? node.h / 2 - 8 : node.h / 2 + 1} 
              fontSize={13} fontWeight={600} fontFamily={T.sans}
              fill={isActive ? T.text : p.text} 
              dominantBaseline="middle"
              style={{ pointerEvents: 'none' }}
            >
              {node.label}
            </text>
            {node.sublabel && (
              <text
                x={18} y={node.h / 2 + 10} 
                fontSize={10} fontFamily={T.mono}
                fill={p.label} dominantBaseline="middle"
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
        <div key={i} style={{
          marginBottom: 32, paddingBottom: 32,
          borderBottom: i < sections.length - 1 ? `1px solid ${T.border}` : 'none',
          position: 'relative', paddingLeft: 20,
        }}>
          <div style={{
            position: 'absolute', left: 0, top: 2, bottom: 0, width: 4, 
            background: SECTION_COLORS[i % SECTION_COLORS.length],
            borderRadius: 4, opacity: 0.85,
          }} />
          {s.heading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ 
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                background: SECTION_COLORS[i % SECTION_COLORS.length] + '15',
                color: SECTION_COLORS[i % SECTION_COLORS.length],
                border: `1px solid ${SECTION_COLORS[i % SECTION_COLORS.length]}30`,
                fontFamily: T.mono, letterSpacing: '0.05em', 
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: T.sans, letterSpacing: '-0.01em' }}>
                {s.heading}
              </span> 
            </div>
          )}
          <p style={{
            fontSize: 14, color: T.textMuted, lineHeight: 1.7,
            margin: 0, whiteSpace: 'pre-wrap', fontFamily: T.sans,
          }}>
            {s.body} 
          </p>
        </div>
      ))}
    </div>
  );
} 

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArchitectureDiagram({ arch, repoUrl, onClose }: ArchCanvasProps) {
  const [view, setView] = useState<ViewMode>('diagram');
  const [zoom, setZoom] = useState(1); 
  const [copied, setCopied] = useState(false); 
  const [activeNode, setActiveNode] = useState<string | null>(null);

  // Auto-switch to explanation when no graph data exists 
  useEffect(() => {
    const hasGraph   = (arch.graph?.nodes?.length ?? 0) > 0;
    const hasMermaid = !!arch.mermaid;
    if (!hasGraph && !hasMermaid && view === 'diagram') setView('explanation');
  }, [arch, view]);

  // Build diagram — JSON graph first, Mermaid as fallback 
  const diagramData = useMemo<DiagramData | null>(() => { 
    const nodes = arch.graph?.nodes;
    if (nodes && nodes.length > 0) {
      try { return layoutJsonGraph(arch.graph as ArchGraph); }
      catch (e) { console.error('JSON graph layout error:', e); }
    }
    if (arch.mermaid) return parseMermaidToDiagram(arch.mermaid);
    return null;
  }, [arch]);

  const hasDiagram  = !!diagramData && diagramData.nodes.length > 0; 
  const nodeCount   = diagramData?.nodes.length ?? 0;
  const edgeCount   = diagramData?.edges.length ?? 0; 

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

  const zoomIn  = useCallback(() => setZoom(z => Math.min(2.5,  parseFloat((z + 0.15).toFixed(2)))), []); 
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.25, parseFloat((z - 0.15).toFixed(2)))), []); 
  const zoomReset = useCallback(() => setZoom(1), []);

  return ( 
    <div className="arch-modal-root" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', background: T.bg, fontFamily: T.sans }}>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        
        .arch-modal-root { flex-direction: row; }
        .arch-left-rail { width: 340px; flex-shrink: 0; background: #FFFFFF; border-right: 1px solid ${T.border}; display: flex; flex-direction: column; z-index: 10; box-shadow: 4px 0 24px rgba(0,0,0,0.02); }
        .arch-center-pane { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        
        @media (max-width: 900px) {
          .arch-modal-root { flex-direction: column-reverse; } 
          .arch-left-rail { width: 100%; height: 45vh; border-right: none; border-top: 1px solid ${T.border}; box-shadow: 0 -4px 24px rgba(0,0,0,0.05); }
          .arch-center-pane { height: 55vh; }
        }

        .arch-tab:hover   { background: #F9FAFB !important; color: ${T.text} !important; }
        .arch-btn:hover   { background: #F9FAFB !important; border-color: ${T.textDim} !important; color: ${T.text} !important; } 
        .arch-close:hover { background: #FEF2F2 !important; border-color: #FECACA !important; color: #DC2626 !important; }
        .arch-row:hover   { background: #F9FAFB !important; }
      `}</style>

      {/* ── LEFT RAIL ────────────────────────────────────────────────────── */}
      <div className="arch-left-rail"> 

        {/* Header */}
        <div style={{ padding: '24px 24px 16px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#F9FAFB', border: `1px solid ${T.border}`, 
            borderRadius: 20, padding: '4px 12px 4px 10px', marginBottom: 12,
          }}>
            <span style={{ color: T.text, fontSize: 14 }}>❖</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: T.text, fontFamily: T.mono, letterSpacing: '0.05em' }}>
              {repoName}
            </span>
          </div>

          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, lineHeight: 1.25, marginBottom: 12, letterSpacing: '-0.02em' }}> 
            {arch.title || `${repoShort} Architecture`} 
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {hasDiagram && (
              <>
                <Chip label={`${nodeCount} nodes`} color={T.cyan} />
                <Chip label={`${edgeCount} edges`} color={T.green} />
              </> 
            )}
            {arch.explanation && (
              <Chip label={`${parseExplanation(arch.explanation).length} sections`} color={T.pink} />
            )}
            {arch._cached && <Chip label="cached" color={T.textDim} />}
          </div>
        </div> 

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}` }}>
          {(['diagram', 'explanation'] as ViewMode[]).map(v => (
            <button
              key={v}
              className="arch-tab"
              onClick={() => setView(v)} 
              disabled={v === 'diagram' && !hasDiagram}
              style={{
                flex: 1,
                fontSize: 12, fontWeight: view === v ? 600 : 500, 
                padding: '14px 12px', fontFamily: T.sans, border: 'none',
                borderBottom: view === v ? `2px solid ${T.text}` : '2px solid transparent', 
                color: view === v ? T.text : T.textMuted, 
                cursor: v === 'diagram' && !hasDiagram ? 'not-allowed' : 'pointer', 
                background: 'none', transition: 'all 0.15s', textTransform: 'capitalize',
                opacity: v === 'diagram' && !hasDiagram ? 0.4 : 1, 
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Rail body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'explanation' ? (
            <div style={{ paddingTop: 24 }}>
              <ExplanationPanel arch={arch} />
            </div>

          ) : hasDiagram ? ( 
            <div style={{ padding: '24px' }}>
              {activeNodeData ? (
                /* Node detail */
                <div style={{ animation: 'fadeUp 0.2s ease' }}>
                  <SectionLabel>SELECTED NODE</SectionLabel>
                  {(() => { 
                    const p = getPalette(activeNodeData.layer);
                    return (
                      <div style={{
                        background: '#FFFFFF', border: `1px solid ${T.border}`, 
                        borderRadius: 12, padding: '16px', marginBottom: 20,
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4, letterSpacing: '-0.01em' }}>
                          {activeNodeData.label} 
                        </div>
                        {activeNodeData.sublabel && (
                          <div style={{ fontSize: 12, color: T.textMuted, fontFamily: T.mono, marginBottom: 10 }}> 
                            {activeNodeData.sublabel}
                          </div>
                        )}
                        <div style={{ display: 'inline-block', padding: '2px 8px', background: p.bg, border: `1px solid ${p.border}40`, borderRadius: 6, fontSize: 10, color: p.text, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}> 
                          {activeNodeData.layer}
                        </div>
                      </div>
                    ); 
                  })()} 

                  {connectedEdges.length > 0 && (
                    <>
                      <SectionLabel>CONNECTIONS ({connectedEdges.length})</SectionLabel>
                      {connectedEdges.slice(0, 10).map((e, i) => {
                        const isOut = e.from === activeNode; 
                        return (
                          <div
                            key={i}
                            className="arch-row" 
                            onClick={() => setActiveNode(isOut ? e.to : e.from)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10, 
                              marginBottom: 6, padding: '8px 10px', borderRadius: 8,
                              cursor: 'pointer', transition: 'background 0.1s', border: `1px solid transparent`
                            }}
                          >
                            <span style={{ fontSize: 12, color: isOut ? T.cyan : T.green, fontWeight: 700, width: 16, flexShrink: 0, textAlign: 'center' }}>
                              {isOut ? '→' : '←'}
                            </span>
                            <span style={{ fontSize: 12, color: T.text, fontFamily: T.mono, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isOut ? e.to : e.from} 
                            </span>
                            {e.label && (
                              <span style={{ fontSize: 10, color: T.textDim, fontFamily: T.mono, flexShrink: 0 }}> 
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
                      fontSize: 12, fontWeight: 600, padding: '10px 16px', borderRadius: 8, 
                      border: `1px solid ${T.border}`, background: '#FFFFFF', color: T.text,
                      cursor: 'pointer', fontFamily: T.sans, marginTop: 16, width: '100%',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)', transition: 'all 0.15s'
                    }}
                  >
                    Clear selection
                  </button>
                </div>

              ) : (
                /* Default rail */ 
                <>
                  <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6, fontFamily: T.sans, marginBottom: 24 }}>
                    {arch.explanation
                      ? arch.explanation.replace(/\*\*/g, '').slice(0, 200) + '…' 
                      : 'Click any node in the diagram to explore its connections.'}
                  </div>
                  {arch.explanation && (
                    <button
                      className="arch-btn" 
                      onClick={() => setView('explanation')}
                      style={{
                        fontSize: 12, fontWeight: 600, padding: '10px 16px', borderRadius: 8,
                        border: `1px solid ${T.border}`, background: '#FFFFFF', 
                        color: T.text, cursor: 'pointer', fontFamily: T.sans,
                        width: '100%', transition: 'all 0.15s', marginBottom: 32,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      Read full explanation →
                    </button>
                  )}

                  <SectionLabel>LAYER LEGEND</SectionLabel> 
                  {Object.entries(PALETTE)
                    .filter(([k]) => k !== 'default')
                    .map(([name, p]) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}> 
                        <div style={{ width: 12, height: 12, borderRadius: 3, background: p.bg, border: `1px solid ${p.border}80`, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: T.textMuted, fontFamily: T.sans, fontWeight: 500, textTransform: 'capitalize' }}>
                          {name} 
                        </span>
                      </div>
                    ))}
                </>
              )}
            </div> 

          ) : (
            /* No diagram */
            <div style={{ textAlign: 'center', padding: '64px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📐</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 8 }}>
                No diagram available
              </div>
              <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                Switch to <strong>Explanation</strong> to read the architecture breakdown.
              </div> 
              <button
                onClick={() => setView('explanation')}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '10px 20px', borderRadius: 8,
                  border: `1px solid ${T.border}`, background: '#FFFFFF', 
                  color: T.text, cursor: 'pointer', fontFamily: T.sans,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                Go to Explanation
              </button>
            </div>
          )} 
        </div>
      </div>

      {/* ── CENTER PANE ──────────────────────────────────────────────────── */}
      <div className="arch-center-pane">

        {/* Toolbar */}
        <div style={{
          padding: '12px 20px', borderBottom: `1px solid ${T.border}`, background: '#FFFFFF',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.textMuted, fontFamily: T.sans, flex: 1 }}>
            {hasDiagram
              ? `Architecture diagram · ${nodeCount} nodes · ${edgeCount} edges` 
              : 'Architecture explanation'}
          </span>

          {hasDiagram && (
            <>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: '#F9FAFB', border: `1px solid ${T.border}`, 
                borderRadius: 8, padding: '4px 8px',
              }}>
                <TBtn onClick={zoomOut}>−</TBtn>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.text, minWidth: 44, textAlign: 'center', fontFamily: T.mono }}>
                  {Math.round(zoom * 100)}% 
                </span>
                <TBtn onClick={zoomIn}>+</TBtn>
                <TBtn onClick={zoomReset}>⌂</TBtn>
              </div>
              <Divider />
              <ABtn onClick={handleCopy} active={copied}> 
                {copied ? '✓ Copied' : 'Copy'}
              </ABtn>
              <ABtn onClick={handleExport}>↓ SVG</ABtn>
              <Divider />
            </>
          )}

          <button
            className="arch-close" 
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${T.border}`, background: '#FFFFFF', color: T.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              cursor: 'pointer', fontSize: 16, fontWeight: 600,
              transition: 'all 0.15s', fontFamily: T.sans,
            }}
          >
            ✕
          </button>
        </div>

        {/* Canvas */} 
        <div style={{
          flex: 1, overflow: 'auto', padding: 40,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          background: `radial-gradient(circle at 50% 50%, #F9FAFB 0%, #F3F4F6 100%)`,
        }}>
          {view === 'explanation' ? ( 
            <div style={{
              maxWidth: 760, width: '100%', background: '#FFFFFF',
              border: `1px solid ${T.border}`, borderRadius: 12, padding: '48px 0',
              boxShadow: '0 10px 40px rgba(0,0,0,0.03)', animation: 'fadeUp 0.25s ease',
            }}>
              <div style={{ padding: '0 44px', marginBottom: 32 }}> 
                <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: '-0.02em', marginBottom: 6 }}>
                  Architecture Breakdown
                </div>
                <div style={{ fontSize: 14, color: T.textMuted, fontWeight: 500 }}>{arch.title ?? repoName}</div>
              </div> 
              <div style={{ paddingLeft: 20 }}>
                <ExplanationPanel arch={arch} />
              </div>
            </div>

          ) : !hasDiagram ? ( 
            <div style={{
              maxWidth: 480, textAlign: 'center', background: '#FFFFFF',
              border: `1px solid ${T.border}`, borderRadius: 12, padding: '64px 32px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.03)',
            }}>
              <div style={{ fontSize: 64, marginBottom: 20 }}>📐</div> 
              <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 12 }}>
                No diagram available
              </div>
              <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                The architecture graph could not be generated.<br />View the explanation instead. 
              </div>
              <button
                onClick={() => setView('explanation')}
                style={{
                  fontSize: 13, fontWeight: 600, padding: '10px 24px', borderRadius: 8,
                  border: `1px solid ${T.border}`, background: '#FFFFFF', 
                  color: T.text, cursor: 'pointer', fontFamily: T.sans,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}
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
                animation: 'fadeUp 0.25s ease',
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
      </div>
    </div>
  );
} 

// ─── Micro components ─────────────────────────────────────────────────────────

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '4px 10px', borderRadius: 20,
      background: color + '15', color, border: `1px solid ${color}30`, fontFamily: T.mono,
    }}>
      {label}
    </span>
  );
} 

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: T.textDim,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      marginBottom: 12, fontFamily: T.mono,
    }}>
      {children}
    </div>
  );
} 

function Divider() {
  return <div style={{ width: 1, height: 20, background: T.border, flexShrink: 0 }} />;
} 

function TBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
        color: T.textMuted, cursor: 'pointer', fontSize: 16, fontWeight: 600,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.sans,
      }}
    >
      {children}
    </button>
  ); 
}

function ABtn({ onClick, active, children }: { onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      className="arch-btn"
      onClick={onClick}
      style={{
        fontSize: 12, fontWeight: 600, padding: '8px 14px', borderRadius: 8,
        border: `1px solid ${active ? T.green : T.border}`,
        background: active ? '#ECFDF5' : '#FFFFFF',
        color: active ? T.green : T.text, 
        cursor: 'pointer', fontFamily: T.sans, transition: 'all 0.15s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}
    >
      {children}
    </button>
  );
} 