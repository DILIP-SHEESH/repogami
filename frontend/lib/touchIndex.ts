import { GLink } from '../types';

/** Reverse-import BFS — % of codebase that ripples if this file changes. */
export function computeTouchIndex(
  nodeId: string,
  links: GLink[],
  parseableCount: number,
  depth = 6,
) {
  const affected = new Set<string>();
  let frontier = new Set([nodeId]);

  for (let d = 0; d < depth; d++) {
    const next = new Set<string>();
    for (const l of links) {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (frontier.has(t) && s !== nodeId && !affected.has(s)) {
        next.add(s);
        affected.add(s);
      }
    }
    frontier = next;
    if (!frontier.size) break;
  }

  const pct = Math.round((affected.size / Math.max(parseableCount, 1)) * 1000) / 10;
  let risk_label: string;
  let risk_color: string;
  if (pct >= 35) { risk_label = 'Nuclear'; risk_color = '#ef4444'; }
  else if (pct >= 18) { risk_label = 'High'; risk_color = '#f97316'; }
  else if (pct >= 8) { risk_label = 'Moderate'; risk_color = '#eab308'; }
  else { risk_label = 'Contained'; risk_color = '#22c55e'; }

  return {
    affected_count: affected.size,
    affected_pct: pct,
    risk_label,
    risk_color,
    verdict: `Touching this file can ripple into ${affected.size} others (${pct}% of the graph).`,
  };
}
