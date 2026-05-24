import React, { useState, memo } from 'react';
import { T, ROLES } from '../../theme';
import { GNode } from '../../types';

interface TreeNode {
  name: string; path: string; isFile: boolean;
  children: Record<string, TreeNode>; fileNode?: GNode;
}

function buildTree(nodes: GNode[]): TreeNode {
  const root: TreeNode = { name: '/', path: '', isFile: false, children: {} };
  for (const node of nodes) {
    const parts = node.path.split('/');
    let cur = root;
    parts.forEach((part, i) => {
      if (!cur.children[part]) {
        cur.children[part] = {
          name: part, path: parts.slice(0, i + 1).join('/'),
          isFile: i === parts.length - 1, children: {},
          fileNode: i === parts.length - 1 ? node : undefined,
        };
      }
      cur = cur.children[part];
    });
  }
  return root;
}

const FileTreeNode = memo(({ node, depth, selectedId, onSelect }: {
  node: TreeNode; depth: number;
  selectedId: string | null | undefined;
  onSelect?: (n: GNode) => void;
}) => {
  const [open, setOpen] = useState(depth < 2);
  const isSelected = node.fileNode?.id === selectedId;

  if (node.isFile && node.fileNode) {
    const fn = node.fileNode;
    const roleDef = ROLES[fn.role] ?? ROLES.default;
    const ext = fn.name.split('.').pop() ?? '';

    return (
      <div
        onClick={() => onSelect?.(fn)}
        style={{
          paddingLeft: depth * 14 + 10, paddingRight: 10,
          paddingTop: 4, paddingBottom: 4,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
          background: isSelected ? T.bgActive : 'transparent',
          borderLeft: `2px solid ${isSelected ? roleDef.color : 'transparent'}`,
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = T.bgHover; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: roleDef.color, flexShrink: 0, opacity: 0.9,
        }} />
        <span style={{
          fontSize: 11.5, fontFamily: T.mono,
          color: isSelected ? T.text : T.textMuted,
          fontWeight: isSelected ? 500 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {fn.name}
        </span>
        {(fn.is_hub || fn.is_entry || fn.is_orphan) && (
          <span style={{ fontSize: 9, flexShrink: 0, opacity: 0.7 }}>
            {fn.is_hub && <i className="ti ti-antenna" style={{ color: T.amber, fontSize: 9 }} />}
            {fn.is_entry && <i className="ti ti-triangle-inverted" style={{ color: T.green, fontSize: 9 }} />}
            {fn.is_orphan && <i className="ti ti-unlink" style={{ color: T.red, fontSize: 9 }} />}
          </span>
        )}
      </div>
    );
  }

  const children = Object.values(node.children).sort((a, b) => {
    if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div>
      <div
        onClick={() => setOpen(!open)}
        style={{
          paddingLeft: depth * 14 + 10, paddingRight: 10,
          paddingTop: 5, paddingBottom: 5,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <i className={`ti ${open ? 'ti-chevron-down' : 'ti-chevron-right'}`}
          style={{ fontSize: 10, color: T.textDim, width: 10, flexShrink: 0 }} />
        <i className={`ti ${open ? 'ti-folder-open' : 'ti-folder'}`}
          style={{ fontSize: 12, color: T.amber, flexShrink: 0, opacity: 0.75 }} />
        <span style={{
          fontSize: 12, fontFamily: T.sans, fontWeight: 500,
          color: T.textMuted, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {node.name}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: T.textDim, fontFamily: T.mono, flexShrink: 0 }}>
          {children.length}
        </span>
      </div>
      {open && children.map(child => (
        <FileTreeNode key={child.path} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
});
FileTreeNode.displayName = 'FileTreeNode';

export default function FileTree({ nodes, selectedId, onSelect }: {
  nodes: GNode[];
  selectedId: string | null | undefined;
  onSelect?: (n: GNode) => void;
}) {
  const [search, setSearch] = useState('');
  const tree = buildTree(nodes);

  const filtered = search.trim()
    ? nodes.filter(n => n.path.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '12px 12px 8px',
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 10, fontFamily: T.mono, color: T.textDim,
          letterSpacing: '0.08em', fontWeight: 500, marginBottom: 8,
          textTransform: 'uppercase',
        }}>
          Explorer · {nodes.length} files
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: T.bgSurface, border: `1px solid ${T.border}`,
          borderRadius: 6, padding: '5px 8px',
        }}>
          <i className="ti ti-search" style={{ fontSize: 11, color: T.textDim }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter files…"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: T.text, fontFamily: T.mono, fontSize: 11, flex: 1, minWidth: 0,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: T.textDim, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
              <i className="ti ti-x" style={{ fontSize: 11 }} />
            </button>
          )}
        </div>
      </div>

      {/* Tree or filtered list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {filtered ? (
          filtered.length === 0
            ? <div style={{ padding: '20px 16px', fontSize: 11, color: T.textDim, fontFamily: T.mono }}>No matches</div>
            : filtered.map(fn => {
              const roleDef = ROLES[fn.role] ?? ROLES.default;
              return (
                <div key={fn.id}
                  onClick={() => onSelect?.(fn)}
                  style={{
                    padding: '5px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: selectedId === fn.id ? T.bgActive : 'transparent',
                    borderLeft: `2px solid ${selectedId === fn.id ? roleDef.color : 'transparent'}`,
                  }}
                  onMouseEnter={e => { if (selectedId !== fn.id) e.currentTarget.style.background = T.bgHover; }}
                  onMouseLeave={e => { if (selectedId !== fn.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: roleDef.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: T.mono, color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {fn.path}
                  </span>
                </div>
              );
            })
        ) : (
          Object.values(tree.children)
            .sort((a, b) => { if (a.isFile !== b.isFile) return a.isFile ? 1 : -1; return a.name.localeCompare(b.name); })
            .map(child => <FileTreeNode key={child.path} node={child} depth={0} selectedId={selectedId} onSelect={onSelect} />)
        )}
      </div>

      {/* Legend */}
      <div style={{
        padding: '8px 12px', borderTop: `1px solid ${T.border}`,
        display: 'flex', gap: 10, flexWrap: 'wrap',
      }}>
        {[
          { color: T.amber, icon: 'ti-antenna', label: 'hub' },
          { color: T.green, icon: 'ti-triangle-inverted', label: 'entry' },
          { color: T.red,   icon: 'ti-unlink',            label: 'orphan' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.textDim, fontFamily: T.mono }}>
            <i className={`ti ${l.icon}`} style={{ fontSize: 10, color: l.color }} /> {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}