import React, { useCallback, useEffect, useRef, useState } from 'react';
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

const ROLE_VIS: Record<string, {
  color: number;    // THREE hex
  emissive: number; // glow color
  size: number;
  geometry: string; // 'sphere' | 'ico' | 'cone' | 'box' | 'torus' | 'oct'
  bloom: boolean;
  symbol: string;   // legend symbol
}> = {
  hub:    { color: 0xef4444, emissive: 0xfca5a5, size: 11, geometry: 'ico',   bloom: true,  symbol: '⬡' },
  entry:  { color: 0x3b82f6, emissive: 0x93c5fd, size: 8,  geometry: 'cone',  bloom: true,  symbol: '▲' },
  shared: { color: 0x10b981, emissive: 0x6ee7b7, size: 6,  geometry: 'oct',   bloom: false, symbol: '◆' },
  leaf:   { color: 0xf59e0b, emissive: 0xfcd34d, size: 3,  geometry: 'sphere',bloom: false, symbol: '●' },
  orphan: { color: 0x8b5cf6, emissive: 0xc4b5fd, size: 2,  geometry: 'sphere',bloom: false, symbol: '○' },
  config: { color: 0x64748b, emissive: 0x94a3b8, size: 2,  geometry: 'box',   bloom: false, symbol: '□' },
};

function getRoleVis(n: GNode) {
  return ROLE_VIS[n.role] ?? ROLE_VIS.leaf;
}

function setupBloom(graphRef: React.MutableRefObject<any>) {
  const g = graphRef.current;
  if (!g) return;

  try {
    const THREE    = (window as any).THREE;
    const renderer = g.renderer();
    const scene    = g.scene();
    const camera   = g.camera();
    if (!THREE || !renderer || !scene || !camera) return;

    const threeBase = 'https://unpkg.com/three@0.158.0/examples/jsm';

    Promise.all([
      import(/* webpackIgnore: true */ `${threeBase}/postprocessing/EffectComposer.js`),
      import(/* webpackIgnore: true */ `${threeBase}/postprocessing/RenderPass.js`),
      import(/* webpackIgnore: true */ `${threeBase}/postprocessing/UnrealBloomPass.js`),
      import(/* webpackIgnore: true */ `${threeBase}/postprocessing/OutputPass.js`),
    ]).then(([{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }]) => {
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      // Toned down bloom for white background
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.5,   // strength
        0.4,   // radius
        0.8,   // threshold
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());

      g.pauseAnimation();
      g.resumeAnimation();

      const origRender = renderer.render.bind(renderer);
      renderer.render = () => composer.render();

      (g as any).__composer = composer;
      (g as any).__origRender = origRender;
    }).catch(() => {
      // Silent fallback
    });
  } catch {
    // Silent fallback
  }
}

function addStarField(graphRef: React.MutableRefObject<any>) {
  const g = graphRef.current;
  if (!g) return;
  try {
    const THREE = (window as any).THREE;
    if (!THREE) return;
    const scene = g.scene();

    const old = scene.getObjectByName('__starfield');
    if (old) scene.remove(old);

    const count = 1500;
    const geo   = new THREE.BufferGeometry();
    const pos   = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3]     = (Math.random() - 0.5) * 4000;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4000;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 4000;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color: 0x000000,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.05,
    });
    const stars = new THREE.Points(geo, mat);
    stars.name = '__starfield';
    scene.add(stars);
  } catch {
    // Silent
  }
}

// ─── Animated pulse ring on hub nodes ────────────────────────────────────────

const pulseRings: { mesh: any; born: number }[] = [];

function makePulseRing(THREE: any, x: number, y: number, z: number, scene: any) {
  const geo  = new THREE.RingGeometry(0.1, 0.3, 32);
  const mat  = new THREE.MeshBasicMaterial({
    color: 0x3b82f6, side: THREE.DoubleSide, transparent: true, opacity: 0.3,
  });
  const ring = new THREE.Mesh(geo, mat);
  ring.position.set(x, y, z);
  ring.lookAt(0, 0, 1);
  scene.add(ring);
  pulseRings.push({ mesh: ring, born: performance.now() });
}

function tickPulseRings(scene: any) {
  const now      = performance.now();
  const duration = 1800;
  for (let i = pulseRings.length - 1; i >= 0; i--) {
    const { mesh, born } = pulseRings[i];
    const t = (now - born) / duration;
    if (t > 1) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      pulseRings.splice(i, 1);
    } else {
      const scale = 1 + t * 18;
      mesh.scale.set(scale, scale, scale);
      mesh.material.opacity = 0.3 * (1 - t);
    }
  }
}


type ShockwaveState = { mesh: any; born: number } | null;
let activeShockwave: ShockwaveState = null;

function fireShockwave(THREE: any, x: number, y: number, z: number, scene: any) {
  if (activeShockwave) {
    scene.remove(activeShockwave.mesh);
    activeShockwave.mesh.geometry.dispose();
    activeShockwave.mesh.material.dispose();
  }
  const geo  = new THREE.SphereGeometry(1, 32, 32);
  const mat  = new THREE.MeshBasicMaterial({
    color: 0x000000, wireframe: true, transparent: true, opacity: 0.15,
  });
  const sphere = new THREE.Mesh(geo, mat);
  sphere.position.set(x, y, z);
  scene.add(sphere);
  activeShockwave = { mesh: sphere, born: performance.now() };
}

function tickShockwave(scene: any) {
  if (!activeShockwave) return;
  const t = (performance.now() - activeShockwave.born) / 1200;
  if (t > 1) {
    scene.remove(activeShockwave.mesh);
    activeShockwave.mesh.geometry.dispose();
    activeShockwave.mesh.material.dispose();
    activeShockwave = null;
  } else {
    const scale = 1 + t * 60;
    activeShockwave.mesh.scale.set(scale, scale, scale);
    activeShockwave.mesh.material.opacity = 0.15 * (1 - t);
  }
}

// ─── Custom node Three.js object ─────────────────────────────────────────────

function buildNodeObject(THREE: any, n: GNode, isSelected: boolean, isHighlighted: boolean, isDimmed: boolean) {
  const cfg = getRoleVis(n);

  let geo: any;
  switch (cfg.geometry) {
    case 'ico':    geo = new THREE.IcosahedronGeometry(cfg.size, 1);       break;
    case 'cone':   geo = new THREE.ConeGeometry(cfg.size * 0.7, cfg.size * 1.4, 8); break;
    case 'oct':    geo = new THREE.OctahedronGeometry(cfg.size, 0);        break;
    case 'box':    geo = new THREE.BoxGeometry(cfg.size, cfg.size, cfg.size); break;
    default:       geo = new THREE.SphereGeometry(cfg.size, 12, 8);        break;
  }

  const opacity  = isDimmed ? 0.15 : 1;
  const emissive = isSelected ? 0x000000 : cfg.emissive;
  const color    = isSelected ? 0x111111 : cfg.color; // Black when selected

  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: isSelected ? 0 : isHighlighted ? 0.8 : cfg.bloom ? 0.4 : 0.1,
    metalness: 0.1,
    roughness: 0.6,
    transparent: isDimmed,
    opacity,
  });

  const mesh = new THREE.Mesh(geo, mat);

  if (isSelected) {
    const glowGeo = geo.clone();
    glowGeo.scale(1.5, 1.5, 1.5);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.08, side: THREE.BackSide,
    });
    mesh.add(new THREE.Mesh(glowGeo, glowMat));
  }

  if (n.is_hub && !isDimmed) {
    const ringGeo = new THREE.TorusGeometry(cfg.size * 1.8, cfg.size * 0.15, 8, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xaaaaaa, transparent: true, opacity: isSelected ? 0.8 : 0.3,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2.5;
    mesh.add(ring);
  }

  if (n.is_entry && !isDimmed) {
    const arrowGeo = new THREE.ConeGeometry(cfg.size * 0.35, cfg.size * 0.8, 6);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 });
    const arrow    = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.position.set(0, cfg.size * 1.6, 0);
    mesh.add(arrow);
  }

  return mesh;
}

// ─── Canvas HUD overlay (Light Theme) ─────────────────────────────────────────

function GraphHUD({ data, selectedNode, highlightNodes, blastMode }: {
  data: AnalyzeResult;
  selectedNode: GNode | null;
  highlightNodes: Set<string>;
  blastMode: boolean;
}) {
  return (
    <div style={{
      position: 'absolute', top: 16, right: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
      pointerEvents: 'none', zIndex: 10,
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12, padding: '10px 16px',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', gap: 6,
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      }}>
        <HudStat label="Nodes"   value={data.stats.total_files} />
        <HudStat label="Edges"   value={data.stats.total_edges} />
        <HudStat label="Hubs"    value={data.stats.hub_count ?? 0} accent />
        <HudStat label="Orphans" value={data.stats.orphan_count} dim />
      </div>

      {selectedNode && (
        <div style={{
          background: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 12, padding: '10px 16px',
          backdropFilter: 'blur(12px)',
          maxWidth: 200,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Selected
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111', wordBreak: 'break-all', lineHeight: 1.3, marginBottom: 4 }}>
            {selectedNode.name}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.5)', fontFamily: 'monospace' }}>
            ↑{selectedNode.indegree} ↓{selectedNode.outdegree} · {selectedNode.role}
          </div>
        </div>
      )}

      <div style={{
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 12, padding: '10px 14px',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', gap: 5,
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
      }}>
        {(['hub','entry','shared','leaf','orphan','config'] as const).map(role => {
          const v = ROLE_VIS[role];
          const c = `#${v.color.toString(16).padStart(6, '0')}`;
          return (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: c, width: 14, textAlign: 'center' }}>{v.symbol}</span>
              <span style={{ fontSize: 11, color: '#333', fontWeight: 600, textTransform: 'capitalize' }}>{role}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HudStat({ label, value, accent, dim }: { label: string; value: number; accent?: boolean; dim?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: dim ? 'rgba(0,0,0,0.3)' : accent ? '#3b82f6' : '#111', fontFamily: 'monospace' }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ─── Controls hint ────────────────────────────────────────────────────────────

function ControlsHint() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: 100, padding: '7px 20px',
      fontSize: 11.5, color: '#333', fontWeight: 600,
      backdropFilter: 'blur(12px)', pointerEvents: 'none', zIndex: 10,
      whiteSpace: 'nowrap',
      transition: 'opacity 0.5s',
      opacity: visible ? 1 : 0,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    }}>
      Drag to rotate · Scroll to zoom · Click node to inspect · Right-drag to pan
    </div>
  );
}


function buildNodeLabel(n: GNode): string {
  const role      = ROLES[n.role]?.label ?? 'Module';
  const vis      = ROLE_VIS[n.role] ?? ROLE_VIS.leaf;
  const flags     = [
    n.is_hub    ? `${vis.symbol} hub`    : null,
    n.is_entry  ? `${vis.symbol} entry`  : null,
    n.is_orphan ? `${vis.symbol} orphan` : null,
  ].filter(Boolean).join(' · ');

  return `<div style="font-family:Inter,system-ui,sans-serif;padding:14px 16px;background:rgba(255,255,255,0.95);border:1px solid rgba(0,0,0,0.08);border-radius:14px;color:#111;max-width:260px;box-shadow:0 8px 32px rgba(0,0,0,0.1);backdrop-filter:blur(16px)">
    <div style="font-weight:700;font-size:14px;margin-bottom:5px;word-break:break-all;letter-spacing:-0.01em;line-height:1.3">${n.name}</div>
    <div style="color:rgba(0,0,0,0.5);font-size:11px;margin-bottom:10px;word-break:break-all;font-family:monospace">${n.path}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11px;font-weight:700">
      <span style="color:#111;background:rgba(0,0,0,0.05);padding:3px 9px;border-radius:100px;border:1px solid rgba(0,0,0,0.05)">${role}</span>
      <span style="color:rgba(0,0,0,0.5);display:flex;align-items:center;gap:4px">↑${n.indegree} ↓${n.outdegree}</span>
      ${flags ? `<span style="color:rgba(0,0,0,0.4)">${flags}</span>` : ''}
    </div>
  </div>`;
}

export default function GraphCanvas({
  data, highlightNodes, highlightLinks, selectedNode, handleNodeClick, graphRef,
}: GraphCanvasProps) {
  const engineDone  = useRef(false);
  const frameRef    = useRef<number>(0);
  const [blastMode, setBlastMode] = useState(false);

  const getNodeColor = useCallback((raw: any): string => {
    const n = raw as GNode;
    if (highlightNodes.size > 0) {
      if (n.id === selectedNode?.id) return '#000000';
      if (!highlightNodes.has(n.id)) return '#e5e5e5';
      return '#333333';
    }
    const cfg = getRoleVis(n);
    return `#${cfg.color.toString(16).padStart(6, '0')}`;
  }, [highlightNodes, selectedNode]);

  // Links inverted for light bg
  const getLinkColor = useCallback((raw: any): string => {
    const s  = typeof raw.source === 'object' ? raw.source.id : raw.source;
    const t  = typeof raw.target === 'object' ? raw.target.id : raw.target;
    const k  = `${s}→${t}`;
    if (highlightLinks.size > 0)
      return highlightLinks.has(k) ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.03)';
    return 'rgba(0,0,0,0.1)';
  }, [highlightLinks]);

  const nodeThreeObject = useCallback((raw: any) => {
    const n          = raw as GNode;
    const THREE      = (window as any).THREE;
    if (!THREE) return undefined;

    const isSelected    = n.id === selectedNode?.id;
    const isHighlighted = highlightNodes.has(n.id);
    const isDimmed      = highlightNodes.size > 0 && !isHighlighted && !isSelected;

    return buildNodeObject(THREE, n, isSelected, isHighlighted, isDimmed);
  }, [selectedNode, highlightNodes]);

  const handleEngineStop = useCallback(() => {
    if (engineDone.current) return;
    engineDone.current = true;

    const g = graphRef.current;
    if (!g) return;

    g.zoomToFit(600, 80);

    const THREE = (window as any).THREE;
    if (!THREE) return;

    const scene    = g.scene();
    const renderer = g.renderer();

    // White background
    renderer.setClearColor(0xffffff, 1);

    const existing = scene.getObjectByName('__ambientLight');
    if (!existing) {
      const ambient = new THREE.AmbientLight(0xffffff, 0.7);
      ambient.name = '__ambientLight';
      scene.add(ambient);

      const dir1 = new THREE.DirectionalLight(0xffffff, 0.6);
      dir1.position.set(100, 100, 100);
      scene.add(dir1);

      const dir2 = new THREE.DirectionalLight(0xfff0dd, 0.4);
      dir2.position.set(-100, -50, -100);
      scene.add(dir2);
    }

    addStarField(graphRef);
    setupBloom(graphRef);
  }, [graphRef]);

  useEffect(() => {
    let lastPulse = 0;
    const tick = () => {
      const g = graphRef.current;
      if (g) {
        const THREE = (window as any).THREE;
        const scene = g.scene();
        if (THREE && scene) {
          const now = performance.now();
          if (now - lastPulse > 1600) {
            lastPulse = now;
            const hubs = data.graph.nodes.filter(n => (n as any).is_hub);
            if (hubs.length > 0) {
              const hub = hubs[Math.floor(Math.random() * hubs.length)] as any;
              if (hub.x !== undefined) {
                makePulseRing(THREE, hub.x, hub.y, hub.z || 0, scene);
              }
            }
          }
          tickPulseRings(scene);
          tickShockwave(scene);
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [data, graphRef]);

  const onNodeClick = useCallback((raw: any) => {
    const n = raw as GNode;
    handleNodeClick(n);

    const g = graphRef.current;
    if (!g || n.x === undefined || n.y === undefined) return;

    const dist = 60;
    g.cameraPosition(
      { x: n.x + dist * 0.6, y: n.y + dist * 0.4, z: (n.z || 0) + dist },
      { x: n.x, y: n.y, z: n.z || 0 },
      900,
    );

    const THREE = (window as any).THREE;
    const scene = g.scene();
    if (THREE && scene) {
      fireShockwave(THREE, n.x, n.y, n.z || 0, scene);
    }
  }, [handleNodeClick, graphRef]);

  const nodeThreeObjectExtend = true;

  const nodeSpriteLabel = useCallback((raw: any) => {
    const n = raw as GNode;
    if (!n.is_hub && !n.is_entry) return undefined;
    try {
      const THREE = (window as any).THREE;
      if (!THREE) return undefined;

      const cfg    = getRoleVis(n);
      const canvas = document.createElement('canvas');
      canvas.width  = 512;
      canvas.height = 80;
      const ctx    = canvas.getContext('2d')!;

      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 512, 80);

      // Dark text for light mode
      ctx.fillStyle = n.is_hub ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.6)';
      ctx.font      = `bold ${n.is_hub ? 26 : 22}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        n.name.replace(/\.(tsx?|jsx?|py|go|rs|vue|svelte)$/, '').slice(0, 24),
        256, 40,
      );

      const texture  = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({
        map: texture, transparent: true, depthTest: false,
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(36, 5.6, 1);
      sprite.position.set(0, cfg.size + 9, 0);
      return sprite;
    } catch { return undefined; }
  }, []);

  const getLinkWidth = useCallback((raw: any) => {
    const s = typeof raw.source === 'object' ? raw.source.id : raw.source;
    const t = typeof raw.target === 'object' ? raw.target.id : raw.target;
    return highlightLinks.has(`${s}→${t}`) ? 2.5 : 0.6;
  }, [highlightLinks]);

  const getLinkParticles = useCallback((raw: any) => {
    const s = typeof raw.source === 'object' ? raw.source.id : raw.source;
    const t = typeof raw.target === 'object' ? raw.target.id : raw.target;
    return highlightLinks.has(`${s}→${t}`) ? 4 : 0;
  }, [highlightLinks]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#ffffff' }}>
      <ForceGraph3D
        ref={graphRef}
        graphData={data.graph}
        backgroundColor="#ffffff"
        nodeId="id"
        nodeLabel={(n: any) => buildNodeLabel(n as GNode)}
        nodeColor={getNodeColor}
        nodeVal={(n: any) => getRoleVis(n as GNode).size}
        nodeOpacity={1}
        nodeResolution={16}
        nodeThreeObject={nodeSpriteLabel}
        nodeThreeObjectExtend={nodeThreeObjectExtend}
        linkColor={getLinkColor}
        linkWidth={getLinkWidth}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkDirectionalArrowColor={getLinkColor}
        linkDirectionalParticles={getLinkParticles}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleColor={() => 'rgba(0,0,0,0.5)'}
        onNodeClick={onNodeClick}
        cooldownTicks={180}
        onEngineStop={handleEngineStop}
        showNavInfo={false}
        enableNodeDrag={true}
        enableNavigationControls={true}
        rendererConfig={{ antialias: true, alpha: false }}
      />

      <GraphHUD
        data={data}
        selectedNode={selectedNode}
        highlightNodes={highlightNodes}
        blastMode={false}
      />

      <ControlsHint />
    </div>
  );
}