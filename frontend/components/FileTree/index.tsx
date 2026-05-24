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

    return (
      <div
        onClick={() => onSelect?.(fn)}
        style={{
          paddingLeft: depth * 14 + 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          backgroundColor: isSelected ? T.bgHover : 'transparent',
          borderLeft: `2px solid ${isSelected ? T.text : 'transparent'}`,
          transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = T.bgHover; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: roleDef.color, flexShrink: 0 }} />
        <span style={{
          fontSize: 13, fontFamily: T.sans, color: isSelected ? T.text : T.textMuted,
          fontWeight: isSelected ? 600 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {fn.name}
        </span>
        {(fn.is_hub || fn.is_entry || fn.is_orphan) && (
          <span style={{ fontSize: 10, flexShrink: 0, display: 'flex', gap: 4 }}>
            {fn.is_hub && <i className="ti ti-antenna" style={{ color: T.text, fontSize: 12, opacity: 0.8 }} />}
            {fn.is_entry && <i className="ti ti-triangle-inverted" style={{ color: T.text, fontSize: 12, opacity: 0.8 }} />}
            {fn.is_orphan && <i className="ti ti-unlink" style={{ color: T.textDim, fontSize: 12 }} />}
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
          paddingLeft: depth * 14 + 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'background-color 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = T.bgHover}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        <i className={`ti ${open ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize: 12, color: T.textDim, width: 12, flexShrink: 0 }} />
        <i className={`ti ${open ? 'ti-folder-open' : 'ti-folder'}`} style={{ fontSize: 14, color: T.textMuted, flexShrink: 0 }} />
        <span style={{ fontSize: 13, fontFamily: T.sans, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: T.textDim, fontFamily: T.sans, fontWeight: 600, flexShrink: 0 }}>
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

export default function FileTree({ nodes, selectedId, onSelect }: { nodes: GNode[]; selectedId: string | null | undefined; onSelect?: (n: GNode) => void; }) {
  const [search, setSearch] = useState('');
  const tree = buildTree(nodes);

  const filtered = search.trim()
    ? nodes.filter(n => n.path.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: T.bgElevated }}>
      {/* Header */}
      <div style={{ padding: '16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ fontSize: 11, fontFamily: T.sans, color: T.textMuted, letterSpacing: '0.05em', fontWeight: 700, marginBottom: 12, textTransform: 'uppercase' }}>
          Explorer <span style={{ opacity: 0.5 }}>· {nodes.length} files</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, backgroundColor: T.bgSurface, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '8px 12px', transition: 'all 0.2s ease', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)'
        }}
        onFocusCapture={e => e.currentTarget.style.borderColor = '#111'}
        onBlurCapture={e => e.currentTarget.style.borderColor = T.border}
        >
          <i className="ti ti-search" style={{ fontSize: 14, color: T.textDim }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter files…"
            style={{ backgroundColor: 'transparent', border: 'none', outline: 'none', color: T.text, fontFamily: T.sans, fontSize: 13, flex: 1, minWidth: 0, fontWeight: 500 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ backgroundColor: 'transparent', border: 'none', color: T.textDim, cursor: 'pointer', padding: 0, lineHeight: 1 }}>
              <i className="ti ti-x" style={{ fontSize: 13 }} />
            </button>
          )}
        </div>
      </div>

      {/* Tree or filtered list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {filtered ? (
          filtered.length === 0
            ? <div style={{ padding: '32px 24px', fontSize: 13, color: T.textDim, fontFamily: T.sans, textAlign: 'center', fontWeight: 500 }}>No matches found</div>
            : filtered.map(fn => {
              const roleDef = ROLES[fn.role] ?? ROLES.default;
              return (
                <div key={fn.id}
                  onClick={() => onSelect?.(fn)}
                  style={{
                    padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                    backgroundColor: selectedId === fn.id ? T.bgHover : 'transparent',
                    borderLeft: `2px solid ${selectedId === fn.id ? T.text : 'transparent'}`,
                    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                  onMouseEnter={e => { if (selectedId !== fn.id) e.currentTarget.style.backgroundColor = T.bgHover; }}
                  onMouseLeave={e => { if (selectedId !== fn.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: roleDef.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontFamily: T.sans, fontWeight: 500, color: selectedId === fn.id ? T.text : T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
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
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, display: 'flex', gap: 16, flexWrap: 'wrap', backgroundColor: T.bgElevated }}>
        {[
          { icon: 'ti-antenna', label: 'hub' },
          { icon: 'ti-triangle-inverted', label: 'entry' },
          { icon: 'ti-unlink', label: 'orphan' },
        ].map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: T.textMuted, fontFamily: T.sans, fontWeight: 600 }}>
            <i className={`ti ${l.icon}`} style={{ fontSize: 13, color: T.textDim }} /> {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}