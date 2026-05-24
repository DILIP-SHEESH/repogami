import React, { useCallback } from 'react';
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
      if (n.id === selectedNode?.id) return '#111111'; // Pure black for selected
      if (!highlightNodes.has(n.id)) return '#e5e5e5'; // Light gray for dimmed
      return '#333333'; // Dark gray for highlighted neighbors
    }
    return base;
  }, [highlightNodes, selectedNode]);

  const getLinkColor = useCallback((raw: any): string => {
    const s  = typeof raw.source === 'object' ? raw.source.id : raw.source;
    const t2 = typeof raw.target === 'object' ? raw.target.id : raw.target;
    const key = `${s}→${t2}`;
    if (highlightLinks.size > 0)
      return highlightLinks.has(key) ? 'rgba(17, 17, 17, 0.6)' : 'rgba(17, 17, 17, 0.05)';
    return 'rgba(17, 17, 17, 0.15)'; // Default subtle black line
  }, [highlightLinks]);

  const nodeLabel = useCallback((raw: any) => {
    const n = raw as GNode;
    const role = ROLES[n.role]?.label ?? 'Module';
    const flags = [
      n.is_hub    ? '⬡ hub'    : null,
      n.is_entry  ? '▶ entry'  : null,
      n.is_orphan ? '⊘ orphan' : null,
    ].filter(Boolean).join(' · ');
    
    // Light theme HTML Tooltip
    return `<div style="font-family:Inter,sans-serif;padding:12px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;color:#111111;max-width:240px;box-shadow:0 8px 24px rgba(0,0,0,0.06)">
      <div style="font-weight:600;font-size:13px;margin-bottom:4px;word-break:break-all">${n.name}</div>
      <div style="color:#888888;font-size:11px;margin-bottom:10px;word-break:break-all">${n.path}</div>
      <div style="display:flex;gap:10px;font-size:11px;font-weight:500">
        <span style="color:${ROLES[n.role]?.color ?? '#888'}">${role}</span>
        <span style="color:#555">↑${n.indegree} ↓${n.outdegree}</span>
        ${flags ? `<span style="color:#888">${flags}</span>` : ''}
      </div>
    </div>`;
  }, []);

  const nodeThreeObject = useCallback((raw: any) => {
    const n = raw as GNode;
    if (!n.is_hub && !n.is_entry) return undefined;

    try {
      const THREE = (window as any).THREE;
      if (!THREE) return undefined;

      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = n.is_hub ? '#111111' : '#555555';
      ctx.font = 'bold 24px Inter, sans-serif';
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
      nodeOpacity={1}
      nodeResolution={16}
      nodeThreeObject={nodeThreeObject}
      linkColor={getLinkColor}
      linkWidth={(l: any) => {
        const s  = typeof l.source === 'object' ? l.source.id : l.source;
        const t2 = typeof l.target === 'object' ? l.target.id : l.target;
        return highlightLinks.has(`${s}→${t2}`) ? 2 : 0.8;
      }}
      linkDirectionalArrowLength={4}
      linkDirectionalArrowRelPos={1}
      linkDirectionalArrowColor={getLinkColor}
      linkDirectionalParticles={(l: any) => {
        const s  = typeof l.source === 'object' ? l.source.id : l.source;
        const t2 = typeof l.target === 'object' ? l.target.id : l.target;
        return highlightLinks.has(`${s}→${t2}`) ? 2 : 0;
      }}
      linkDirectionalParticleSpeed={0.005}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleColor={() => '#111111'}
      onNodeClick={handleNodeClick}
      cooldownTicks={120}
      onEngineStop={() => graphRef.current?.zoomToFit(400, 80)}
      showNavInfo={false}
    />
  );
}