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
  };

  const TABS = [
    { id: 'summary', label: 'Project',  icon: 'ti-layout-dashboard' },
    { id: 'node',    label: 'Inspect',  icon: 'ti-atom'             },
    { id: 'ai',      label: 'Ask AI',   icon: 'ti-message-circle-2' },
    { id: 'arch',    label: 'Diagram',  icon: 'ti-sitemap'          },
  ] as const;

  export default function SidebarShell({ sidebarTab, setSidebarTab, ...panelProps }: SidebarProps) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', background: T.bgElevated }}>

        {/* Tab bar */}
        <div className="rg-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`rg-tab${sidebarTab === tab.id ? ' active' : ''}`}
              onClick={() => setSidebarTab(tab.id)}
            >
              <i className={`ti ${tab.icon}`} style={{ fontSize: 13 }} />
              <span style={{ fontSize: 10 }}>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Panel content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {sidebarTab === 'summary' && <SummaryPanel {...panelProps} />}
          {sidebarTab === 'node'    && <NodePanel    {...panelProps} />}
          {sidebarTab === 'ai'      && <AskPanel     {...panelProps} />}
          {sidebarTab === 'arch'    && <ArchPanel    {...panelProps} />}
        </div>
      </div>
    );
  }