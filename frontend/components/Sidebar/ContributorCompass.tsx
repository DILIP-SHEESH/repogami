'use client';

import React from 'react';
import { T } from '../../theme';
import { CompassStep, GNode } from '../../types';

interface Props {
  steps: CompassStep[];
  onInspectNode?: (node: GNode) => void;
  nodes: GNode[];
}

export default function ContributorCompass({ steps, onInspectNode, nodes }: Props) {
  if (!steps.length) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontFamily: T.sans, fontWeight: 700, color: T.textMuted,
        letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <i className="ti ti-compass" style={{ fontSize: 14 }} />
        Contributor Compass
        <span style={{ fontSize: 10, fontWeight: 500, color: T.textDim, textTransform: 'none', letterSpacing: 0 }}>
          — read in this order
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {steps.map((s, i) => {
          const node = nodes.find(n => n.id === s.path);
          return (
            <div key={s.path} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: '#111', color: '#fff',
                  fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {s.step}
                </div>
                {i < steps.length - 1 && (
                  <div style={{ width: 2, flex: 1, minHeight: 16, background: T.border, margin: '4px 0' }} />
                )}
              </div>
              <button
                type="button"
                onClick={() => node && onInspectNode?.(node)}
                style={{
                  flex: 1, textAlign: 'left', padding: '0 0 16px', background: 'none', border: 'none',
                  cursor: node ? 'pointer' : 'default', fontFamily: T.sans,
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>
                  {s.name}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, lineHeight: 1.5 }}>{s.reason}</div>
                <div style={{ fontSize: 10, fontFamily: T.mono, color: T.textDim, marginTop: 4 }}>
                  {s.path}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
