import React, { useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { T, ROLES } from '../../theme';
import { AnalyzeResult, GNode } from '../../types';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

interface GraphCanvasProps {
  data: AnalyzeResult;
  highlightNodes: Set<string>;
  highlightLinks: Set<string>;
  selectedNode: GNode | null;
  handleNodeClick: (node: any) => void;
  graphRef: React.MutableRefObject<any>;
}

function nodeSize(n: GNode): number {
  if (n.is_hub)    return 10;
  if (n.is_entry)  return 7;
  if (n.role === 'shared') return 6;
  if (n.is_orphan) return 3;
  if (n.is_config) return 3;
  return 4;
}

// Truncate filename for in-graph labels
function shortLabel(n: GNode): string {
  const name = n.name.replace(/\.(tsx?|jsx?|py|go|rs|vue|svelte)$/, '');
  return name.length > 16 ? name.slice(0, 15) + '…' : name;
}

export default function GraphCanvas({ data, highlightNodes, highlightLinks, selectedNode, handleNodeClick, graphRef }: GraphCanvasProps) {

  const getNodeColor = useCallback((raw: any): string => {
    const n = raw as GNode;
    const base = ROLES[n.role]?.color ?? T.textDim;
    if (highlightNodes.size > 0) {
      if (n.id === selectedNode?.id) return '#FFFFFF';
      if (!highlightNodes.has(n.id)) return '#2A2A2D';
      return base;
    }
    return base;
  }, [highlightNodes, selectedNode]);

  const getLinkColor = useCallback((raw: any): string => {
    const s  = typeof raw.source === 'object' ? raw.source.id : raw.source;
    const t2 = typeof raw.target === 'object' ? raw.target.id : raw.target;
    const key = `${s}→${t2}`;
    if (highlightLinks.size > 0)
      return highlightLinks.has(key) ? 'rgba(34,211,238,0.65)' : 'rgba(255,255,255,0.02)';
    return 'rgba(255,255,255,0.07)';
  }, [highlightLinks]);

  const nodeLabel = useCallback((raw: any) => {
    const n = raw as GNode;
    const role = ROLES[n.role]?.label ?? 'Module';
    const flags = [
      n.is_hub    ? '⬡ hub'    : null,
      n.is_entry  ? '▶ entry'  : null,
      n.is_orphan ? '⊘ orphan' : null,
    ].filter(Boolean).join(' · ');
    return `<div style="font-family:DM Mono,monospace;font-size:11px;padding:6px 10px;background:#111;border:1px solid #333;border-radius:6px;color:#fafafa;max-width:200px">
      <div style="font-weight:500;margin-bottom:2px">${n.name}</div>
      <div style="color:#71717a;font-size:10px">${n.path}</div>
      <div style="margin-top:4px;display:flex;gap:8px;font-size:10px">
        <span style="color:${ROLES[n.role]?.color ?? '#71717a'}">${role}</span>
        <span style="color:#52525b">↑${n.indegree} ↓${n.outdegree}</span>
        ${flags ? `<span style="color:#a1a1aa">${flags}</span>` : ''}
      </div>
    </div>`;
  }, []);

  const nodeThreeObject = useCallback((raw: any) => {
    // Return undefined to use default spheres; labels are handled via nodeLabel (HTML tooltip)
    // We add text sprites only for hub/entry nodes to reduce clutter
    const n = raw as GNode;
    if (!n.is_hub && !n.is_entry) return undefined;

    // Dynamic import THREE inside callback (safe for SSR)
    try {
      const THREE = (window as any).THREE;
      if (!THREE) return undefined;

      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = n.is_hub ? '#22D3EE' : '#4ADE80';
      ctx.font = 'bold 24px DM Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(shortLabel(n), 128, 40);

      const texture = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(20, 5, 1);
      sprite.position.set(0, nodeSize(n) + 5, 0);
      return sprite;
    } catch {
      return undefined;
    }
  }, []);

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={data.graph}
      backgroundColor={T.bg}
      nodeId="id"
      nodeLabel={nodeLabel}
      nodeColor={getNodeColor}
      nodeVal={(n: any) => nodeSize(n as GNode)}
      nodeOpacity={0.92}
      nodeResolution={16}
      nodeThreeObject={nodeThreeObject}
      linkColor={getLinkColor}
      linkWidth={(l: any) => {
        const s  = typeof l.source === 'object' ? l.source.id : l.source;
        const t2 = typeof l.target === 'object' ? l.target.id : l.target;
        return highlightLinks.has(`${s}→${t2}`) ? 2 : 0.5;
      }}
      linkDirectionalArrowLength={3.5}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={getLinkColor}
      linkDirectionalParticles={(l: any) => {
        const s  = typeof l.source === 'object' ? l.source.id : l.source;
        const t2 = typeof l.target === 'object' ? l.target.id : l.target;
        return highlightLinks.has(`${s}→${t2}`) ? 3 : 0;
      }}
      linkDirectionalParticleSpeed={0.005}
      linkDirectionalParticleWidth={1.5}
      linkDirectionalParticleColor={() => T.cyan}
      onNodeClick={handleNodeClick}
      cooldownTicks={120}
      onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
      showNavInfo={false}
    />
  );
}