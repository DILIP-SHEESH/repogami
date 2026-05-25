export type Role = 'entry' | 'hub' | 'shared' | 'leaf' | 'orphan' | 'config';

export interface GNode {
  id: string; name: string; path: string; dir: string;
  language: string; lang_color: string; extension: string;
  size: number; role: Role; indegree: number; outdegree: number;
  dependents: string[]; dependencies: string[];
  is_orphan: boolean; is_entry: boolean; is_hub: boolean; is_config: boolean;
  x?: number; y?: number; z?: number; __threeObj?: any;
}

export interface GLink { source: string | GNode; target: string | GNode; }

export interface Summary {
  project_name: string; tagline: string; description: string;
  tech_stack: string[]; architecture: string; entry_points: string[];
  key_modules: string[]; complexity: 'low' | 'medium' | 'high'; insights: string[];
}

export interface Stats {
  total_files: number; total_edges: number; orphan_count: number;
  hub_count: number; entry_count: number; shared_count: number;
  languages: Record<string, number>;
  top_hubs: { id: string; name: string; indegree: number }[];
  role_counts: Record<string, number>;
}

export interface CodebaseVitals {
  health_score: number;
  health_grade: string;
  health_color: string;
  tagline: string;
  metrics: {
    coupling_index: number;
    orphan_ratio_pct: number;
    hub_concentration_pct: number;
    mutual_import_pairs: number;
    layer_diversity: number;
    dominant_layer: string;
  };
  layers: Record<string, number>;
  smell_radar: {
    id: string;
    severity: 'low' | 'medium' | 'high';
    title: string;
    detail: string;
    metric: number;
    inspect_ids: string[];
  }[];
  refactor_playbook: {
    priority: number;
    action: string;
    why: string;
    effort: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    target_id?: string;
  }[];
  god_files: { id: string; name: string; indegree: number; path: string }[];
}

export interface CompassStep {
  step: number;
  path: string;
  name: string;
  role: Role;
  reason: string;
  indegree: number;
}

export interface RepoDna {
  personality: { type: string; emoji: string; one_liner: string };
  viral_headline: string;
  share_tweet: string;
  share_card: {
    headline: string;
    personality: string;
    emoji: string;
    health: number;
    grade: string;
    color: string;
    stats_line: string;
    compass_preview: string[];
  };
  share_url_path: string;
  danger_file?: { id: string; name: string; indegree: number; path: string } | null;
}

export interface TouchIndex {
  affected_count: number;
  affected_pct: number;
  risk_label: string;
  risk_color: string;
  verdict: string;
}

export interface AnalyzeResult {
  graph: { nodes: GNode[]; links: GLink[] };
  summary: Summary; stats: Stats;
  vitals?: CodebaseVitals;
  contributor_compass?: CompassStep[];
  repo_dna?: RepoDna;
  meta: { owner: string; repo: string; url: string; truncated: boolean; files_fetched_for_deps: number; branch: string; };
}

export interface ArchComponent {
  id: string; name: string; tech: string; description: string;
  files: string[]; is_external: boolean;
}

export interface ArchLayer {
  id: string; name: string; color: string; description: string;
  components: ArchComponent[];
}

export interface ArchConnection {
  from: string; to: string; label: string; protocol: string;
  type: 'request' | 'data' | 'control' | 'dependency'; description: string;
}

// Replace the old ArchComponent, ArchLayer, ArchConnection, ArchResult with this:
export interface ArchGraphNode {
  id: string;
  label: string;
  type: string;
  group: string | null;
  node: string;
}

export interface ArchGraphEdge {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed' | 'thick';
}

export interface ArchGraphGroup {
  id: string;
  label: string;
}

export interface ArchGraph {
  nodes: ArchGraphNode[];
  edges: ArchGraphEdge[];
  groups: ArchGraphGroup[];
}

export interface ArchResult {
    title: string;
    explanation: string;
    mermaid?: string;
    graph?: ArchGraph;      // v3 — structured JSON graph from backend
    _cached?: boolean;
  }