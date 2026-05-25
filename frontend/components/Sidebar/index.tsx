'use client';

import React from 'react';
import { T } from '../../theme';
import NodePanel from './NodePanel';
import AskPanel from './AskPanel';
import SummaryPanel from './SummaryPanel';
import ArchPanel from './ArchPanel';
import { AnalyzeResult, GNode, ArchResult } from '../../types';

export type SidebarProps = {
  sidebarTab: 'node' | 'ai' | 'summary' | 'arch';
  setSidebarTab: (tab: 'node' | 'ai' | 'summary' | 'arch') => void;
  data: AnalyzeResult | null;
  selectedNode: GNode | null;
  handleNodeClick: (node: GNode) => void;
  runBlast: () => void;
  blastLoading: boolean;
  aiQuestion: string;
  setAiQuestion: (q: string) => void;
  handleAsk: (q?: string) => void;
  aiLoading: boolean;
  aiAnswer: string;
  generateReadme: () => void;
  readmeLoading: boolean;
  readme: string;
  arch: ArchResult | null;
  generateArchitecture: () => void;
  archLoading: boolean;
  // ── New props for blast radius ──
  analyzedUrl: string;
  apiBase: string;
  onHighlight: (ids: Set<string>) => void;
  onInspectIds?: (ids: string[]) => void;
};

const TABS = [
  { id: 'summary', label: 'Project',  icon: 'ti-layout-dashboard' },
  { id: 'node',    label: 'Inspect',  icon: 'ti-atom'             },
  { id: 'ai',      label: 'Ask AI',   icon: 'ti-message-circle-2' },
  { id: 'arch',    label: 'Diagram',  icon: 'ti-sitemap'          },
] as const;

export default function SidebarShell({
  sidebarTab,
  setSidebarTab,
  analyzedUrl,
  apiBase,
  onHighlight,
  onInspectIds,
  ...panelProps
}: SidebarProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      width: '100%', background: T.bgElevated,
    }}>
      {/* Tab bar */}
      <div style={{
        display: 'flex', padding: '8px', gap: '4px',
        borderBottom: `1px solid ${T.border}`,
        background: T.bgSurface, zIndex: 10,
      }}>
        {TABS.map(tab => {
          const isActive = sidebarTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSidebarTab(tab.id)}
              style={{
                flex: 1, height: 36, border: 'none', borderRadius: 8,
                background: isActive ? T.bgActive : 'transparent',
                color: isActive ? T.text : T.textDim,
                cursor: 'pointer', fontFamily: T.sans, fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.02)' : 'none',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.bgHover; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <i className={`ti ${tab.icon}`} style={{ fontSize: 14 }} />
              <span className="hide-mobile">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {sidebarTab === 'summary' && (
          <SummaryPanel
            {...panelProps}
            analyzedUrl={analyzedUrl}
            onInspectIds={onInspectIds}
            onInspectNode={panelProps.handleNodeClick}
          />
        )}
        {sidebarTab === 'node'    && (
          <NodePanel
            {...panelProps}
            analyzedUrl={analyzedUrl}
            apiBase={apiBase}
            onHighlight={onHighlight}
          />
        )}
        {sidebarTab === 'ai'      && <AskPanel  {...panelProps} />}
        {sidebarTab === 'arch'    && <ArchPanel {...panelProps} />}
      </div>
    </div>
  );
}