'use client';

/**
 * ArchitectureDiagram — v4 (canvas rewrite)
 *
 * What changed vs v3:
 *  - Infinite canvas: mouse-wheel zoom + middle-button/space-drag pan
 *  - Nodes rendered as HTML divs (no SVG foreignObject hacks) → no text clipping ever
 *  - Draggable individual nodes with live edge redraw
 *  - Minimap (bottom-right) for orientation on large graphs
 *  - Hover tooltip shows full label + type without truncation
 *  - Click → inline expanded panel (connections list, role badge, layer)
 *  - "Fit to screen" button auto-centers + scales the graph
 *  - Edge routing via SVG overlay (z-index below node divs)
 *  - Layer bands still present but as lightweight background strips
 *  - All existing view modes (diagram / files / explanation) preserved
 */

import React, {
  useState, useCallback, useEffect, useMemo, useRef, useLayoutEffect,
} from 'react';
import { T } from '../../theme';
import { ArchResult, ArchGraph, ArchGraphNode, ArchGraphEdge, ArchGraphGroup } from '../../types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArchCanvasProps {
  arch: ArchResult;
  repoUrl: string;
  onClose: () => void;
  analysisNodes?: AnalysisNode[];
}

interface AnalysisNode {
  id: string; name: string; path: string; dir: string; language: string;
  lang_color: string; extension: string; size: number;
  role: 'entry' | 'hub' | 'shared' | 'leaf' | 'orphan' | 'config';
  indegree: number; outdegree: number; dependents: string[]; dependencies: string[];
  is_orphan: boolean; is_entry: boolean; is_hub: boolean; is_config: boolean;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_ORDER = ['frontend','api','services','models','data','utils','infra','config','tests'];
const NODE_W        = 200;
const NODE_H_MIN    = 72;     // minimum; grows with content
const H_GAP         = 40;
const V_GAP         = 56;
const LAYER_PAD_TOP = 52;
const LAYER_PAD_BOT = 32;
const CANVAS_SIDE   = 56;
const MAX_COLS      = 4;

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

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; desc: string }> = {
  entry:  { label: 'Entry',   color: '#0C7D4B', bg: '#E6F5EE', icon: 'ti-triangle-inverted', desc: 'Execution starts here'    },
  hub:    { label: 'Hub',     color: '#7C3AED', bg: '#F0EBFF', icon: 'ti-antenna',            desc: 'Imported by many files'    },
  shared: { label: 'Shared',  color: '#0369A1', bg: '#E0F2FE', icon: 'ti-puzzle',             desc: 'Used by multiple domains'  },
  leaf:   { label: 'Leaf',    color: '#555555', bg: '#F5F5F5', icon: 'ti-leaf',               desc: 'Imported by no other file' },
  orphan: { label: 'Orphan',  color: '#B45309', bg: '#FFF7ED', icon: 'ti-unlink',             desc: 'No connections at all'     },
  config: { label: 'Config',  color: '#374151', bg: '#F3F4F6', icon: 'ti-settings-2',         desc: 'Configuration file'        },
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

// ─── Layout (unchanged from v3, just wider nodes) ─────────────────────────────

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
    ...LAYER_ORDER.map(l => allKeys.find(k => k.toLowerCase() === l)).filter((k): k is string => !!k),
    ...allKeys.filter(k => !LAYER_ORDER.includes(k.toLowerCase())).sort(),
  ];

  let canvasWidth = 500;
  for (const ids of Object.values(layerBuckets)) {
    const cols = Math.min(ids.length, MAX_COLS);
    const w = CANVAS_SIDE * 2 + cols * NODE_W + (cols - 1) * H_GAP;
    if (w > canvasWidth) canvasWidth = w;
  }

  const nodeInfo: Record<string, { label: string; sublabel: string }> = {};
  for (const n of gNodes) {
    nodeInfo[n.id] = { label: n.label || n.id, sublabel: n.type || '' };
  }

  const layoutNodes: DiagramNode[] = [];
  const layoutLayers: DiagramData['layers'] = [];
  let curY = 40;

  for (const layerName of orderedLayers) {
    const ids = layerBuckets[layerName] ?? [];
    const rowCount = Math.ceil(ids.length / MAX_COLS);
    const layerH = LAYER_PAD_TOP + rowCount * NODE_H_MIN + Math.max(0, rowCount - 1) * V_GAP + LAYER_PAD_BOT;
    layoutLayers.push({ id: layerName, label: layerName, y: curY, h: layerH });

    ids.forEach((id, i) => {
      const col     = i % MAX_COLS;
      const row     = Math.floor(i / MAX_COLS);
      const rowCols = Math.min(ids.length - row * MAX_COLS, MAX_COLS);
      const rowW    = rowCols * NODE_W + (rowCols - 1) * H_GAP;
      const offsetX = (canvasWidth - rowW) / 2;
      const info    = nodeInfo[id] ?? { label: id, sublabel: '' };

      layoutNodes.push({
        id, label: info.label, sublabel: info.sublabel, layer: layerName,
        x: offsetX + col * (NODE_W + H_GAP),
        y: curY + LAYER_PAD_TOP + row * (NODE_H_MIN + V_GAP),
        w: NODE_W, h: NODE_H_MIN,
      });
    });
    curY += layerH + 32;
  }

  const canvasHeight = curY + 40;
  const nodeIdSet    = new Set(layoutNodes.map(n => n.id));
  const layoutEdges: DiagramEdge[] = gEdges
    .filter(e => nodeIdSet.has(e.from) && nodeIdSet.has(e.to) && e.from !== e.to)
    .map(e => ({ from: e.from, to: e.to, label: e.label ?? '', style: (e.style ?? 'solid') as 'solid' | 'dashed' | 'thick' }));

  return { nodes: layoutNodes, edges: layoutEdges, layers: layoutLayers, width: canvasWidth, height: canvasHeight };
}

function parseMermaidToDiagram(src: string): DiagramData | null {
  try {
    const lines = src.replace(/^```mermaid\n?/gi, '').replace(/\n?```$/g, '').split('\n').map(l => l.trim()).filter(Boolean);
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
        rawEdges.push({ from, to, label: label?.trim() ?? '', style: arrow.includes('=') ? 'thick' : arrow.includes('-.-') ? 'dashed' : 'solid' });
      }
    }

    const allIds = Array.from(new Set([...Object.keys(nodeLabels), ...rawEdges.flatMap(e => [e.from, e.to])]));
    const seenGroups = new Set<string>();
    const groups: ArchGraphGroup[] = [];
    for (const id of allIds) {
      const l = layerMap[id] ?? 'default';
      if (!seenGroups.has(l)) { seenGroups.add(l); groups.push({ id: l, label: l }); }
    }
    const nodes: ArchGraphNode[] = allIds.map(id => {
      const raw   = nodeLabels[id] ?? id;
      const parts = raw.split('\n');
      return { id, node: id, label: parts[0] ?? id, type: parts.slice(1).join(' '), group: layerMap[id] ?? 'default' };
    });
    return layoutJsonGraph({ nodes, edges: rawEdges, groups });
  } catch (err) {
    console.error('[Mermaid fallback] parse error:', err);
    return null;
  }
}

// ─── Canvas diagram (HTML overlay + SVG edges) ────────────────────────────────

interface CanvasState {
  offsetX: number; offsetY: number; scale: number;
}

interface NodePositions {
  [id: string]: { x: number; y: number };
}

function useCanvasDrag(containerRef: React.RefObject<HTMLDivElement>) {
  const [canvas, setCanvas] = useState<CanvasState>({ offsetX: 0, offsetY: 0, scale: 1 });
  const dragging = useRef(false);
  const last     = useRef({ x: 0, y: 0 });
  const spaceDown = useRef(false);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx   = e.clientX - rect.left;
      const my   = e.clientY - rect.top;
      setCanvas(prev => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(3, Math.max(0.15, prev.scale * delta));
        const ratio = newScale / prev.scale;
        return {
          scale: newScale,
          offsetX: mx - (mx - prev.offsetX) * ratio,
          offsetY: my - (my - prev.offsetY) * ratio,
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [containerRef]);

  // Space-key panning
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); spaceDown.current = true; } };
    const onKeyUp   = (e: KeyboardEvent) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp); };
  }, []);

  // Mouse pan (middle button OR space held)
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || spaceDown.current) {
      dragging.current = true;
      last.current = { x: e.clientX, y: e.clientY };
      e.preventDefault();
    }
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - last.current.x;
    const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setCanvas(prev => ({ ...prev, offsetX: prev.offsetX + dx, offsetY: prev.offsetY + dy }));
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  return { canvas, setCanvas, onMouseDown, onMouseMove, onMouseUp };
}

// Edge SVG overlay
function EdgeLayer({ data, nodePos, activeNode, canvas }: {
  data: DiagramData;
  nodePos: NodePositions;
  activeNode: string | null;
  canvas: CanvasState;
}) {
  const nodeMap = useMemo(() => {
    const m: Record<string, DiagramNode> = {};
    data.nodes.forEach(n => { m[n.id] = n; });
    return m;
  }, [data.nodes]);

  const getCenter = (id: string): { x: number; y: number; h: number; w: number } => {
    const base = nodeMap[id];
    if (!base) return { x: 0, y: 0, h: NODE_H_MIN, w: NODE_W };
    const pos  = nodePos[id];
    return { x: (pos?.x ?? base.x) + base.w / 2, y: (pos?.y ?? base.y) + base.h / 2, h: base.h, w: base.w };
  };

  const svgW = 99999;
  const svgH = 99999;

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: svgW, height: svgH, pointerEvents: 'none', overflow: 'visible' }}
      viewBox={`0 0 ${svgW} ${svgH}`}
    >
      <defs>
        <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#aaaaaa" />
        </marker>
        <marker id="arr-active" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#111111" />
        </marker>
        <marker id="arr-thick" markerWidth="9" markerHeight="9" refX="8" refY="3.5" orient="auto">
          <path d="M0,0 L0,7 L9,3.5 z" fill="#444444" />
        </marker>
      </defs>
      {data.edges.map((edge, i) => {
        const from = getCenter(edge.from);
        const to   = getCenter(edge.to);
        if (!from || !to) return null;

        const isActive = activeNode === edge.from || activeNode === edge.to;
        const isDimmed = !!activeNode && !isActive;
        const isThick  = edge.style === 'thick';
        const isDash   = edge.style === 'dashed';

        const fx = from.x;
        const fy = from.y + from.h / 2 - 4;
        const tx = to.x;
        const ty = to.y - to.h / 2 + 4;
        const dy = Math.abs(ty - fy);
        const cp1y = fy + dy * 0.5;
        const cp2y = ty - dy * 0.5;
        const d = `M ${fx} ${fy} C ${fx} ${cp1y}, ${tx} ${cp2y}, ${tx} ${ty}`;
        const midX = (fx + tx) / 2;
        const midY = (fy + ty) / 2 - 8;

        const stroke = isThick ? '#333' : isActive ? '#111' : '#bbbbbb';
        const strokeW = isThick ? 3 : isActive ? 1.8 : 1;
        const marker = isThick ? 'url(#arr-thick)' : isActive ? 'url(#arr-active)' : 'url(#arr)';

        return (
          <g key={i} opacity={isDimmed ? 0.1 : 1} style={{ transition: 'opacity 0.2s' }}>
            <path d={d} fill="none" stroke={stroke} strokeWidth={strokeW}
              strokeDasharray={isDash ? '6 4' : undefined}
              markerEnd={marker}
              style={{ transition: 'stroke 0.2s, stroke-width 0.2s' }}
            />
            {edge.label && isActive && (
              <text x={midX} y={midY} textAnchor="middle" fontSize={11} fill="#444"
                fontFamily="'DM Mono', 'JetBrains Mono', monospace" fontWeight={600}
                style={{ pointerEvents: 'none' }}>
                {edge.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Individual draggable node
function DiagramNodeCard({
  node, isActive, isDimmed, onActivate,
  onDragEnd,
}: {
  node: DiagramNode;
  isActive: boolean;
  isDimmed: boolean;
  onActivate: (id: string | null) => void;
  onDragEnd: (id: string, dx: number, dy: number) => void;
}) {
  const [hovering, setHovering] = useState(false);
  const dragStart = useRef<{ mx: number; my: number } | null>(null);
  const totalDrag = useRef({ dx: 0, dy: 0 });
  const isDragging = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragStart.current = { mx: e.clientX, my: e.clientY };
    totalDrag.current = { dx: 0, dy: 0 };
    isDragging.current = false;

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current!.mx;
      const dy = ev.clientY - dragStart.current!.my;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) isDragging.current = true;
      totalDrag.current = { dx, dy };
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (isDragging.current) {
        onDragEnd(node.id, totalDrag.current.dx, totalDrag.current.dy);
      } else {
        onActivate(isActive ? null : node.id);
      }
      isDragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [node.id, isActive, onActivate, onDragEnd]);

  const roleKey = Object.keys(ROLE_CONFIG).find(r =>
    node.sublabel.toLowerCase().includes(r)
  );
  const role = roleKey ? ROLE_CONFIG[roleKey] : null;

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      style={{
        position: 'absolute',
        left: node.x, top: node.y,
        width: node.w,
        minHeight: node.h,
        background: isActive ? '#fff' : T.bgSurface,
        border: `${isActive ? 2 : 1}px solid ${isActive ? '#111' : hovering ? '#999' : T.border}`,
        borderRadius: 16,
        padding: '14px 16px',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        userSelect: 'none',
        opacity: isDimmed ? 0.18 : 1,
        transition: 'opacity 0.2s, border-color 0.15s, box-shadow 0.2s',
        boxShadow: isActive
          ? '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)'
          : hovering
            ? '0 6px 24px rgba(0,0,0,0.1)'
            : '0 2px 8px rgba(0,0,0,0.04)',
        zIndex: isActive ? 20 : hovering ? 15 : 10,
        outline: isActive ? '3px solid rgba(0,0,0,0.06)' : 'none',
        outlineOffset: 3,
        backdropFilter: isActive ? 'blur(4px)' : 'none',
      }}
    >
      {/* Label — full text, wraps */}
      <div style={{
        fontSize: 13, fontWeight: 700, color: isActive ? '#111' : T.text,
        fontFamily: "'DM Sans', 'Geist', system-ui, sans-serif",
        lineHeight: 1.35, marginBottom: node.sublabel ? 6 : 0,
        wordBreak: 'break-word',
        letterSpacing: '-0.01em',
      }}>
        {node.label}
      </div>
      {/* Sublabel — full text, wraps */}
      {node.sublabel && (
        <div style={{
          fontSize: 11.5, color: T.textDim,
          fontFamily: "'DM Mono', 'JetBrains Mono', monospace",
          lineHeight: 1.5, wordBreak: 'break-word',
        }}>
          {node.sublabel}
        </div>
      )}
      {/* Layer chip */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        marginTop: 10, padding: '3px 8px',
        borderRadius: 100, fontSize: 10, fontWeight: 700,
        background: T.bgHover, color: T.textDim,
        fontFamily: "'DM Sans', system-ui, sans-serif",
        letterSpacing: '0.04em', textTransform: 'uppercase',
        border: `1px solid ${T.border}`,
      }}>
        {node.layer}
      </div>

      {/* Hover tooltip — shows when NOT active, appears above */}
      {hovering && !isActive && node.sublabel && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
          transform: 'translateX(-50%)',
          background: '#111', color: '#fff',
          padding: '8px 12px', borderRadius: 10,
          fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif",
          maxWidth: 280, whiteSpace: 'normal', wordBreak: 'break-word',
          zIndex: 100, pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{node.label}</div>
          <div style={{ opacity: 0.8 }}>{node.sublabel}</div>
          <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '6px solid #111' }} />
        </div>
      )}
    </div>
  );
}

// Minimap
function Minimap({ data, nodePos, canvas, viewW, viewH }: {
  data: DiagramData; nodePos: NodePositions;
  canvas: CanvasState; viewW: number; viewH: number;
}) {
  const MM_W = 160; const MM_H = 100;
  const margin = 12;
  const allX = data.nodes.map(n => (nodePos[n.id]?.x ?? n.x));
  const allY = data.nodes.map(n => (nodePos[n.id]?.y ?? n.y));
  const minX = Math.min(...allX) - 20;
  const minY = Math.min(...allY) - 20;
  const maxX = Math.max(...allX.map((x, i) => x + data.nodes[i].w)) + 20;
  const maxY = Math.max(...allY.map((y, i) => y + data.nodes[i].h)) + 20;
  const gW = maxX - minX || 1;
  const gH = maxY - minY || 1;

  const toMM = (x: number, y: number) => ({
    x: ((x - minX) / gW) * MM_W,
    y: ((y - minY) / gH) * MM_H,
  });

  // Viewport rect in minimap coords
  const vpLeft   = (-canvas.offsetX / canvas.scale - minX) / gW * MM_W;
  const vpTop    = (-canvas.offsetY / canvas.scale - minY) / gH * MM_H;
  const vpWidth  = (viewW  / canvas.scale) / gW * MM_W;
  const vpHeight = (viewH  / canvas.scale) / gH * MM_H;

  return (
    <div style={{
      position: 'absolute', bottom: margin + 56, right: margin,
      width: MM_W, height: MM_H,
      background: 'rgba(255,255,255,0.94)',
      border: `1px solid ${T.border}`,
      borderRadius: 10, overflow: 'hidden',
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      zIndex: 50,
    }}>
      <svg width={MM_W} height={MM_H} style={{ display: 'block' }}>
        {/* Layer bands */}
        {data.layers.map(layer => {
          const ty = toMM(0, layer.y).y;
          const bh = (layer.h / gH) * MM_H;
          return (
            <rect key={layer.id} x={0} y={ty} width={MM_W} height={bh}
              fill="rgba(0,0,0,0.025)" stroke="none" />
          );
        })}
        {/* Nodes */}
        {data.nodes.map(n => {
          const pos = toMM(nodePos[n.id]?.x ?? n.x, nodePos[n.id]?.y ?? n.y);
          const nw  = (n.w / gW) * MM_W;
          const nh  = (n.h / gH) * MM_H;
          return (
            <rect key={n.id} x={pos.x} y={pos.y} width={Math.max(nw, 3)} height={Math.max(nh, 2)}
              rx={2} fill="#888" opacity={0.5} />
          );
        })}
        {/* Edges */}
        {data.edges.slice(0, 40).map((e, i) => {
          const fn = data.nodes.find(n => n.id === e.from);
          const tn = data.nodes.find(n => n.id === e.to);
          if (!fn || !tn) return null;
          const fp = toMM((nodePos[fn.id]?.x ?? fn.x) + fn.w/2, (nodePos[fn.id]?.y ?? fn.y) + fn.h/2);
          const tp = toMM((nodePos[tn.id]?.x ?? tn.x) + tn.w/2, (nodePos[tn.id]?.y ?? tn.y) + tn.h/2);
          return <line key={i} x1={fp.x} y1={fp.y} x2={tp.x} y2={tp.y} stroke="#bbb" strokeWidth={0.5} />;
        })}
        {/* Viewport rect */}
        <rect x={vpLeft} y={vpTop} width={vpWidth} height={vpHeight}
          fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.5)" strokeWidth={1} rx={2} />
      </svg>
    </div>
  );
}

// ─── Canvas Diagram root ──────────────────────────────────────────────────────

function CanvasDiagram({ data, onNodeSelect, activeNode }: {
  data: DiagramData;
  onNodeSelect: (id: string | null) => void;
  activeNode: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null!);
  const [viewSize, setViewSize] = useState({ w: 800, h: 600 });
  const [nodePos, setNodePos] = useState<NodePositions>(() => {
    const m: NodePositions = {};
    data.nodes.forEach(n => { m[n.id] = { x: n.x, y: n.y }; });
    return m;
  });

  const { canvas, setCanvas, onMouseDown, onMouseMove, onMouseUp } = useCanvasDrag(containerRef);

  // Fit-to-screen on first mount
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      setViewSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Auto-fit when we get a real view size
  useEffect(() => {
    if (viewSize.w < 100) return;
    const padding = 48;
    const scaleX = (viewSize.w - padding * 2) / data.width;
    const scaleY = (viewSize.h - padding * 2) / data.height;
    const s = Math.min(scaleX, scaleY, 1);
    setCanvas({
      scale: s,
      offsetX: (viewSize.w - data.width * s) / 2,
      offsetY: padding,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSize.w, viewSize.h, data.width, data.height]);

  const fitToScreen = useCallback(() => {
    const padding = 48;
    const s = Math.min(
      (viewSize.w - padding * 2) / data.width,
      (viewSize.h - padding * 2) / data.height,
      1,
    );
    setCanvas({
      scale: s,
      offsetX: (viewSize.w - data.width * s) / 2,
      offsetY: padding,
    });
  }, [viewSize, data.width, data.height, setCanvas]);

  const zoomIn    = () => setCanvas(p => ({ ...p, scale: Math.min(3, p.scale * 1.2) }));
  const zoomOut   = () => setCanvas(p => ({ ...p, scale: Math.max(0.15, p.scale / 1.2) }));

  const handleDragEnd = useCallback((id: string, dx: number, dy: number) => {
    setNodePos(prev => ({
      ...prev,
      [id]: {
        x: (prev[id]?.x ?? data.nodes.find(n => n.id === id)?.x ?? 0) + dx / canvas.scale,
        y: (prev[id]?.y ?? data.nodes.find(n => n.id === id)?.y ?? 0) + dy / canvas.scale,
      },
    }));
  }, [canvas.scale, data.nodes]);

  // Dynamically apply node positions
  const positionedNodes: DiagramNode[] = useMemo(() =>
    data.nodes.map(n => ({
      ...n,
      x: nodePos[n.id]?.x ?? n.x,
      y: nodePos[n.id]?.y ?? n.y,
    })),
  [data.nodes, nodePos]);

  const connectedEdges = useMemo(() =>
    data.edges.filter(e => e.from === activeNode || e.to === activeNode),
  [data.edges, activeNode]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: T.bgHover,
      backgroundImage: `radial-gradient(circle, ${T.borderMid} 1px, transparent 1px)`,
      backgroundSize: '28px 28px',
    }}>
      {/* Pan/zoom container */}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', cursor: 'default', position: 'relative' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* World transform */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          transform: `translate(${canvas.offsetX}px, ${canvas.offsetY}px) scale(${canvas.scale})`,
          transformOrigin: '0 0',
          width: data.width, height: data.height,
          willChange: 'transform',
        }}>
          {/* Layer bands (behind everything) */}
          {data.layers.map(layer => (
              <div key={layer.id} style={{
                position: 'absolute', left: CANVAS_SIDE / 2, top: layer.y,
                width: data.width - CANVAS_SIDE, height: layer.h,
                borderRadius: 24,
                background: layer.label === 'Other' ? 'rgba(0,0,0,0.008)' : 'rgba(0,0,0,0.015)',
                border: layer.label === 'Other' ? `1px dashed rgba(0,0,0,0.04)` : `1px solid rgba(0,0,0,0.06)`,
                transition: 'background 0.3s',
              }}>
                <div style={{
                  position: 'absolute', top: 16, left: 20,
                  fontSize: 11, fontWeight: 700, color: layer.label === 'Other' ? T.textDim : '#555',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  userSelect: 'none',
                }}>
                  {layer.label}
                </div>
              </div>
          ))}

          {/* SVG edge overlay */}
          <EdgeLayer
            data={{ ...data, nodes: positionedNodes }}
            nodePos={nodePos}
            activeNode={activeNode}
            canvas={canvas}
          />

          {/* Node cards */}
          {positionedNodes.map(node => (
            <DiagramNodeCard
              key={node.id}
              node={node}
              isActive={activeNode === node.id}
              isDimmed={!!activeNode && activeNode !== node.id}
              onActivate={onNodeSelect}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      </div>

      {/* HUD — zoom controls */}
      <div style={{
        position: 'absolute', bottom: 16, right: 16,
        display: 'flex', flexDirection: 'column', gap: 4, zIndex: 50,
      }}>
        <HudBtn onClick={zoomIn} title="Zoom in"><i className="ti ti-plus" /></HudBtn>
        <HudBtn onClick={zoomOut} title="Zoom out"><i className="ti ti-minus" /></HudBtn>
        <HudBtn onClick={fitToScreen} title="Fit to screen"><i className="ti ti-arrows-maximize" /></HudBtn>
        {activeNode && (
          <HudBtn onClick={() => onNodeSelect(null)} title="Clear selection"><i className="ti ti-x" /></HudBtn>
        )}
      </div>

      {/* Minimap */}
      <Minimap
        data={{ ...data, nodes: positionedNodes }}
        nodePos={nodePos}
        canvas={canvas}
        viewW={viewSize.w}
        viewH={viewSize.h}
      />

      {/* Active node details panel */}
      {activeNode && (
        <ActivePanel
          node={data.nodes.find(n => n.id === activeNode)!}
          edges={connectedEdges}
          activeNode={activeNode}
          onNavigate={onNodeSelect}
          onClose={() => onNodeSelect(null)}
        />
      )}

      {/* Pan hint (fades after 4s) */}
      <PanHint />
    </div>
  );
}

function PanHint() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)', color: '#fff',
      padding: '6px 14px', borderRadius: 100,
      fontSize: 11.5, fontFamily: "'DM Sans', system-ui, sans-serif",
      fontWeight: 500, pointerEvents: 'none', zIndex: 40,
      opacity: visible ? 1 : 0, transition: 'opacity 0.5s',
    }}>
      Scroll to zoom · Middle-click or Space+drag to pan · Drag nodes to rearrange
    </div>
  );
}

function HudBtn({ onClick, title, children }: { onClick: () => void; title?: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 36, height: 36, borderRadius: 10,
        border: `1px solid ${T.border}`,
        background: hov ? T.bgHover : 'rgba(255,255,255,0.9)',
        color: T.text, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.15s',
        backdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </button>
  );
}

function ActivePanel({ node, edges, activeNode, onNavigate, onClose }: {
  node: DiagramNode; edges: DiagramEdge[];
  activeNode: string; onNavigate: (id: string) => void; onClose: () => void;
}) {
  const outgoing = edges.filter(e => e.from === activeNode);
  const incoming = edges.filter(e => e.to === activeNode);

  return (
    <div style={{
      position: 'absolute', top: 16, left: 16,
      width: 280, maxHeight: 'calc(100% - 32px)',
      background: 'rgba(255,255,255,0.97)',
      border: `1px solid ${T.border}`,
      borderRadius: 18, overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      zIndex: 60,
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 800, color: '#111',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              wordBreak: 'break-word', lineHeight: 1.3, marginBottom: 4,
            }}>
              {node.label}
            </div>
            {node.sublabel && (
              <div style={{
                fontSize: 11.5, color: T.textDim,
                fontFamily: "'DM Mono', monospace",
                wordBreak: 'break-word', lineHeight: 1.4,
              }}>
                {node.sublabel}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            flexShrink: 0, width: 28, height: 28, borderRadius: 8,
            border: `1px solid ${T.border}`, background: T.bgHover,
            cursor: 'pointer', color: T.textDim, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginTop: 10, padding: '3px 9px',
          borderRadius: 100, fontSize: 10, fontWeight: 700,
          background: T.bgHover, color: T.textDim,
          border: `1px solid ${T.border}`,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          {node.layer}
        </div>
      </div>

      {/* Connections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
        {incoming.length > 0 && (
          <SectionBlock label={`↙ Incoming (${incoming.length})`}>
            {incoming.map((e, i) => (
              <ConnRow key={i} id={e.from} label={e.label} icon="ti-arrow-left" onNavigate={onNavigate} />
            ))}
          </SectionBlock>
        )}
        {outgoing.length > 0 && (
          <SectionBlock label={`↗ Outgoing (${outgoing.length})`}>
            {outgoing.map((e, i) => (
              <ConnRow key={i} id={e.to} label={e.label} icon="ti-arrow-right" onNavigate={onNavigate} />
            ))}
          </SectionBlock>
        )}
        {incoming.length === 0 && outgoing.length === 0 && (
          <div style={{ padding: '20px 16px', color: T.textDim, fontSize: 12,
            fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: 'center' }}>
            No connections found
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        padding: '4px 16px', fontSize: 10, fontWeight: 800,
        color: T.textDim, letterSpacing: '0.06em', textTransform: 'uppercase',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function ConnRow({ id, label, icon, onNavigate }: {
  id: string; label: string; icon: string; onNavigate: (id: string) => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => onNavigate(id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        width: '100%', padding: '7px 16px',
        background: hov ? T.bgHover : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.15s',
      }}
    >
      <i className={`ti ${icon}`} style={{ fontSize: 13, color: T.textDim, marginTop: 2, flexShrink: 0 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: T.text,
          fontFamily: "'DM Sans', system-ui, sans-serif",
          wordBreak: 'break-word', lineHeight: 1.3,
        }}>
          {id}
        </div>
        {label && (
          <div style={{
            fontSize: 10.5, color: T.textDim, marginTop: 2,
            fontFamily: "'DM Mono', monospace",
          }}>
            {label}
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Explanation panel (unchanged) ───────────────────────────────────────────

function parseExplanation(raw: string): ExplainSection[] {
  if (!raw) return [];
  const sections: ExplainSection[] = [];
  const parts = raw.split(/\n\n(?=\*\*\d+\.)/);
  for (const part of parts) {
    const m = part.match(/^\*\*(.+?)\*\*/);
    if (m) {
      sections.push({ heading: m[1].replace(/^\d+\.\s*/, ''), body: part.replace(/^\*\*.+?\*\*\n?/, '').trim() });
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
        <div key={i} style={{ marginBottom: 40, paddingLeft: 24, position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 4, bottom: -16, width: 2, background: i < sections.length - 1 ? T.border : 'transparent', borderRadius: 2 }} />
          {s.heading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, marginLeft: -34 }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: T.bgSurface, color: T.text, border: `1px solid ${T.borderMid}`, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, fontWeight: 700, zIndex: 2 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text, letterSpacing: '-0.01em' }}>{s.heading}</span>
            </div>
          )}
          <p style={{ fontSize: 14.5, color: T.textMuted, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap', fontFamily: "'DM Sans', system-ui, sans-serif" }}>{s.body}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Files view (unchanged from v3) ──────────────────────────────────────────

const FILES_GRID = '1fr 100px 84px 96px 76px';

function FilesView({ nodes }: { nodes: AnalysisNode[] }) {
  const [search, setSearch]           = useState('');
  const [roleFilter, setRoleFilter]   = useState<string>('all');
  const [layerFilter, setLayerFilter] = useState<string>('all');
  const [sortKey, setSortKey]         = useState<SortKey>('connections');
  const [sortDir, setSortDir]         = useState<SortDir>('desc');
  const [expanded, setExpanded]       = useState<string | null>(null);

  const enriched   = useMemo(() => nodes.map(n => ({ ...n, layer: detectLayer(n.path) })), [nodes]);
  const allLayers  = useMemo(() => Array.from(new Set(enriched.map(n => n.layer))).sort(), [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n => n.path.toLowerCase().includes(q) || n.name.toLowerCase().includes(q) || n.language.toLowerCase().includes(q));
    }
    if (roleFilter  !== 'all') list = list.filter(n => n.role  === roleFilter);
    if (layerFilter !== 'all') list = list.filter(n => (n as any).layer === layerFilter);
    return [...list].sort((a, b) => {
      let av: string | number = 0; let bv: string | number = 0;
      if (sortKey === 'name')        { av = a.name.toLowerCase();       bv = b.name.toLowerCase(); }
      if (sortKey === 'role')        { av = a.role;                     bv = b.role; }
      if (sortKey === 'connections') { av = a.indegree + a.outdegree;   bv = b.indegree + b.outdegree; }
      if (sortKey === 'layer')       { av = (a as any).layer;           bv = (b as any).layer; }
      if (sortKey === 'language')    { av = a.language;                 bv = b.language; }
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

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 12, flexWrap: 'wrap', flexShrink: 0, backgroundColor: T.bgElevated, alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 10, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 14px' }}>
          <i className="ti ti-search" style={{ fontSize: 16, color: T.textDim }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name, path, or language…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", color: T.text, fontWeight: 500 }} />
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textDim, padding: 0 }}><i className="ti ti-x" style={{ fontSize: 14 }} /></button>}
        </div>
        <select value={layerFilter} onChange={e => setLayerFilter(e.target.value)} style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '8px 36px 8px 14px', fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600, color: T.text, cursor: 'pointer', outline: 'none', appearance: 'none', backgroundImage: `url("data:image/svg+xml;utf8,<svg fill='none' stroke='%23888' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'></path></svg>")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '14px' }}>
          <option value="all">All Layers</option>
          {allLayers.map(l => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
        </select>
      </div>

      <div style={{ padding: '12px 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0, backgroundColor: T.bgSurface }}>
        {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
          const count = roleCounts[role] ?? 0;
          if (!count) return null;
          const active = roleFilter === role;
          return (
            <button key={role} onClick={() => setRoleFilter(active ? 'all' : role)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 100, border: `1px solid ${active ? cfg.color : T.border}`, background: active ? cfg.bg : T.bgElevated, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: active ? cfg.color : T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'all 0.2s' }}>
              <i className={`ti ${cfg.icon}`} style={{ fontSize: 14 }} />{cfg.label}
              <span style={{ background: active ? cfg.color : T.bgHover, color: active ? '#fff' : T.text, borderRadius: 100, padding: '2px 8px', fontSize: 11, fontWeight: 700, marginLeft: 4 }}>{count}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: FILES_GRID, padding: '8px 24px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, backgroundColor: T.bgElevated }}>
        {([['name', 'File'], ['layer', 'Layer'], ['role', 'Role'], ['connections', 'Deps'], ['language', 'Lang']] as [SortKey, string][]).map(([key, label]) => (
          <button key={key} onClick={() => toggleSort(key)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 11, fontWeight: 700, color: sortKey === key ? '#111' : T.textDim, fontFamily: "'DM Sans', system-ui, sans-serif", letterSpacing: '0.05em', textTransform: 'uppercase', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
            {label} {sortKey === key && <span style={{ fontSize: 10 }}>{sortDir === 'asc' ? '↑' : '↓'}</span>}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px', color: T.textDim, fontSize: 14, fontFamily: "'DM Sans', system-ui, sans-serif" }}>No files match your filters.</div>
        ) : filtered.map(node => {
          const role   = ROLE_CONFIG[node.role] ?? ROLE_CONFIG.leaf;
          const isOpen = expanded === node.id;
          const conns  = node.indegree + node.outdegree;
          const layer  = (node as any).layer as string;

          return (
            <div key={node.id} style={{ borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => setExpanded(prev => prev === node.id ? null : node.id)} style={{ display: 'grid', gridTemplateColumns: FILES_GRID, width: '100%', padding: '12px 24px', background: isOpen ? T.bgHover : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', alignItems: 'center', transition: 'background 0.2s' }} onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = T.bgHover; }} onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}>
                <div style={{ minWidth: 0, paddingRight: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "'DM Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</div>
                  {node.dir && node.dir !== '/' && <div style={{ fontSize: 11, color: T.textDim, fontFamily: "'DM Mono', monospace", marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.dir}</div>}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer}</div>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, color: role.color, background: role.bg, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
                    <i className={`ti ${role.icon}`} style={{ fontSize: 12 }} />{role.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 40, height: 6, borderRadius: 100, background: T.border, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 100, width: `${Math.min(100, conns * 8)}%`, background: conns > 8 ? '#111' : conns > 3 ? '#555' : T.borderMid }} />
                  </div>
                  <span style={{ fontSize: 12, color: T.text, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 700 }}>{conns}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: node.lang_color || T.borderMid }} />
                  <span style={{ fontSize: 12, color: T.textDim, fontFamily: "'DM Sans', system-ui, sans-serif", fontWeight: 600 }}>{node.language === 'other' ? node.extension : node.language.slice(0, 8)}</span>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '0 24px 24px', backgroundColor: T.bgHover }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: '20px', background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 16 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: T.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16, fontFamily: "'DM Sans', system-ui, sans-serif" }}>File Metadata</div>
                      <InfoRow label="Full path" value={node.path} mono />
                      <InfoRow label="Role" value={`${role.label} — ${role.desc}`} />
                      <InfoRow label="Layer" value={layer} />
                      <InfoRow label="Language" value={node.language} />
                      <InfoRow label="Size" value={node.size ? `${(node.size / 1024).toFixed(1)} KB` : '—'} />
                    </div>
                    <div>
                      {node.dependents.length > 0 && (
                        <div style={{ marginBottom: 20 }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: T.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }}>Imported by ({node.dependents.length})</div>
                          {node.dependents.slice(0, 8).map(dep => (
                            <div key={dep} style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.text, padding: '6px 0', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                              <i className="ti ti-arrow-left" style={{ color: T.textDim, flexShrink: 0, fontSize: 14 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {node.dependencies.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 800, color: T.textDim, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }}>Imports ({node.dependencies.length})</div>
                          {node.dependencies.slice(0, 8).map(dep => (
                            <div key={dep} style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.text, padding: '6px 0', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>
                              <i className="ti ti-arrow-right" style={{ color: T.textDim, flexShrink: 0, fontSize: 14 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dep}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
    <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.textDim, fontFamily: "'DM Sans', system-ui, sans-serif", minWidth: 80, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: 12, color: T.text, fontFamily: mono ? "'DM Mono', monospace" : "'DM Sans', system-ui, sans-serif", fontWeight: mono ? 500 : 600, overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all' }}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArchitectureDiagram({ arch, repoUrl, onClose, analysisNodes }: ArchCanvasProps) {
  const [view, setView]             = useState<ViewMode>('diagram');
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
    // Export nodes+edges as JSON for downstream use
    const blob = new Blob([JSON.stringify(arch.graph, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href: url, download: `${repoShort}-architecture.json` }).click();
    URL.revokeObjectURL(url);
  }, [arch.graph, repoShort]);

  const tabs: { id: ViewMode; label: string; disabled?: boolean; icon: string }[] = [
    { id: 'diagram',     label: 'Diagram',     disabled: !hasDiagram, icon: 'ti-sitemap' },
    { id: 'files',       label: 'Files',       disabled: !hasFiles,   icon: 'ti-files' },
    { id: 'explanation', label: 'Explanation',                        icon: 'ti-book' },
  ];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', flexDirection: 'row',
      background: T.bg, fontFamily: "'DM Sans', system-ui, sans-serif",
      animation: 'archFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      <style>{`
        @keyframes archFadeIn { from { opacity: 0; transform: scale(0.99); } to { opacity: 1; transform: scale(1); } }
        @keyframes archFadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .arch-left-v4 {
          width: 320px; flex-shrink: 0;
          background: ${T.bgElevated};
          border-right: 1px solid ${T.border};
          display: flex; flex-direction: column;
          z-index: 10; box-shadow: 2px 0 16px rgba(0,0,0,0.02);
        }
        .arch-center-v4 { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      `}</style>

      {/* LEFT RAIL */}
      <div className="arch-left-v4">
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: T.bgSurface, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-brand-github" style={{ fontSize: 13, color: T.text }} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: T.textDim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repoName}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T.text, lineHeight: 1.25, marginBottom: 16, letterSpacing: '-0.03em' }}>
            {arch.title || `${repoShort} Architecture`}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hasDiagram && (<><Chip label={`${nodeCount} nodes`} icon="ti-atom" /><Chip label={`${edgeCount} edges`} icon="ti-arrows-split" /></>)}
            {hasFiles && <Chip label={`${analysisNodes!.length} files`} icon="ti-files" />}
          </div>
        </div>

        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', background: T.bgSurface, padding: 4, borderRadius: 12, border: `1px solid ${T.border}` }}>
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setView(tab.id)} disabled={tab.disabled} style={{ flex: 1, height: 34, background: view === tab.id ? T.bgHover : 'transparent', border: 'none', borderRadius: 8, color: view === tab.id ? T.text : T.textDim, cursor: tab.disabled ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: view === tab.id ? 700 : 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.2s', opacity: tab.disabled ? 0.3 : 1 }}>
                <i className={`ti ${tab.icon}`} style={{ fontSize: 13 }} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {view === 'explanation' ? (
            <div style={{ paddingTop: 20 }}><ExplanationPanel arch={arch} /></div>
          ) : view === 'diagram' && hasDiagram ? (
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, marginBottom: 20, marginTop: 0 }}>
                {arch.explanation ? arch.explanation.replace(/\*\*/g, '').slice(0, 160) + '…' : 'Click any node to see its connections. Drag to rearrange.'}
              </p>
              {arch.explanation && (
                <button onClick={() => setView('explanation')} style={{ width: '100%', justifyContent: 'center', marginBottom: 24, height: 44, background: '#111', border: 'none', color: '#fff', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="ti ti-book" style={{ fontSize: 15 }} /> Read full explanation
                </button>
              )}
              <SLabel>Legend</SLabel>
              <div style={{ fontSize: 12, color: T.textDim, lineHeight: 1.7, marginBottom: 16 }}>
                <div>Scroll wheel to zoom</div>
                <div>Middle-click + drag to pan</div>
                <div>Space + drag to pan</div>
                <div>Drag nodes to rearrange</div>
                <div>Click node for connections</div>
              </div>
            </div>
          ) : view === 'files' && hasFiles ? (
            <div style={{ padding: '20px' }}>
              <div style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6, marginBottom: 20 }}>
                Browse every file with its role, layer, and dependency connections.
              </div>
              <SLabel>Role Legend</SLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(ROLE_CONFIG).map(([role, cfg]) => (
                  <div key={role} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px', borderRadius: 10, background: T.bgSurface, border: `1px solid ${T.border}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0, marginTop: 5 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 2 }}>{cfg.label}</div>
                      <div style={{ fontSize: 11, color: T.textDim }}>{cfg.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 20px' }}>
              <div style={{ fontSize: 14, color: T.textMuted }}>Switch to Explanation to read the architecture breakdown.</div>
            </div>
          )}
        </div>
      </div>

      {/* CENTER PANE */}
      <div className="arch-center-v4">
        {/* Toolbar */}
        <div style={{ height: 56, padding: '0 20px', borderBottom: `1px solid ${T.border}`, backgroundColor: T.bgElevated, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, zIndex: 10 }}>
          <span style={{ fontSize: 13, color: T.textDim, fontWeight: 600, flex: 1, letterSpacing: '0.01em' }}>
            {view === 'files'
              ? `${analysisNodes?.length ?? 0} files · click any row to expand`
              : hasDiagram ? 'Architecture Diagram — drag nodes, scroll to zoom' : 'Architecture Explanation'}
          </span>

          {view === 'diagram' && hasDiagram && (
            <>
              <button onClick={handleCopy} style={{ backgroundColor: copied ? T.text : T.bgSurface, border: `1px solid ${copied ? T.text : T.border}`, borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: copied ? '#fff' : T.text, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s' }}>
                <i className={`ti ${copied ? 'ti-check' : 'ti-copy'}`} style={{ fontSize: 14 }} />{copied ? 'Copied' : 'Copy JSON'}
              </button>
              <button onClick={handleExport} style={{ backgroundColor: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: T.text, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', transition: 'all 0.2s' }}>
                <i className="ti ti-download" style={{ fontSize: 14 }} /> Export
              </button>
              <div style={{ width: 1, height: 20, background: T.border }} />
            </>
          )}

          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgSurface, color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} title="Close">
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        </div>

        {/* Content */}
        {view === 'files' && hasFiles ? (
          <div style={{ flex: 1, position: 'relative' }}><FilesView nodes={analysisNodes!} /></div>
        ) : view === 'explanation' ? (
          <div style={{ flex: 1, overflow: 'auto', padding: 48, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{ maxWidth: 760, width: '100%', background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 24, padding: '48px 0', boxShadow: '0 8px 32px rgba(0,0,0,0.04)' }}>
              <div style={{ padding: '0 48px', marginBottom: 36 }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: 8 }}>Architecture Breakdown</div>
                <div style={{ fontSize: 15, color: T.textMuted }}>{arch.title ?? repoName}</div>
              </div>
              <div style={{ paddingLeft: 24 }}><ExplanationPanel arch={arch} /></div>
            </div>
          </div>
        ) : hasDiagram ? (
          <div style={{ flex: 1, position: 'relative', animation: 'archFadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <CanvasDiagram
              data={diagramData!}
              activeNode={activeNode}
              onNodeSelect={setActiveNode}
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 400, padding: 40 }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.text, marginBottom: 12 }}>No diagram available</div>
              <div style={{ fontSize: 14, color: T.textMuted, marginBottom: 32 }}>View the detailed text explanation instead.</div>
              <button onClick={() => setView('explanation')} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 100, padding: '12px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Read explanation</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Chip({ label, icon }: { label: string; icon?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 100, backgroundColor: T.bgSurface, color: T.text, border: `1px solid ${T.border}`, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {icon && <i className={icon} style={{ fontSize: 13, color: T.textDim }} />} {label}
    </span>
  );
}

function SLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 800, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {children}
    </div>
  );
}