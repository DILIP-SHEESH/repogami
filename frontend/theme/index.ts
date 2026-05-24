export const T = {
  // ── Backgrounds ───────────────────────────────────────────────────────────
  bg:         '#fcfcfc',   // main canvas background
  bgElevated: '#ffffff',   // sidebars, panels
  bgSurface:  '#ffffff',   // cards, inputs
  bgHover:    '#f5f5f5',   // subtle gray hover
  bgActive:   '#ebebeb',   // active selection

  // ── Borders ───────────────────────────────────────────────────────────────
  border:     '#e5e5e5',   // standard light gray border
  borderMid:  '#cccccc',
  borderHi:   '#111111',   // black highlights

  // ── Text ──────────────────────────────────────────────────────────────────
  text:         '#111111', // primary pure dark
  textMuted:    '#555555', // secondary
  textDim:      '#888888', // tertiary / placeholders
  textInverse:  '#ffffff', // text on black

  // ── Accents (Mapped to B&W scale) ─────────────────────────────────────────
  periwinkle:    '#111111', 
  periwinkleDim: '#333333', 
  plum:          '#111111', 
  plumBright:    '#333333', 
  lavender:      '#f5f5f5', 
  navy:          '#111111', 
  
  // ── Semantic ──────────────────────────────────────────────────────────────
  green:     '#10b981',
  greenDim:  '#059669',
  amber:     '#f59e0b',
  amberDim:  '#d97706',
  red:       '#ef4444',
  redDim:    '#dc2626',
  cyan:      '#0ea5e9',

  // ── Typography ────────────────────────────────────────────────────────────
  sans:  '"Inter", "Geist Sans", system-ui, sans-serif',
  mono:  '"Geist Mono", "Fira Code", ui-monospace, monospace',
  serif: '"Lora", Georgia, serif',
};

export const card = {
  background: T.bgSurface,
  borderRadius: 16,
  border: `1px solid ${T.border}`,
};

export const ROLES: Record<string, { color: string; bg: string; label: string; glyph: string; desc: string }> = {
  component: { color: '#111', bg: '#f5f5f5', label: 'Component', glyph: 'ti-layout-2',    desc: 'UI component or view layer'       },
  util:      { color: '#555', bg: '#f5f5f5', label: 'Utility',   glyph: 'ti-bolt',        desc: 'Helper functions and tools'       },
  model:     { color: '#111', bg: '#f5f5f5', label: 'Model',     glyph: 'ti-database',    desc: 'Data structure or schema'         },
  api:       { color: '#555', bg: '#f5f5f5', label: 'API',       glyph: 'ti-api',         desc: 'Network route or API endpoint'    },
  config:    { color: '#888', bg: '#f5f5f5', label: 'Config',    glyph: 'ti-settings-2',  desc: 'Configuration or environment'     },
  test:      { color: '#111', bg: '#f5f5f5', label: 'Test',      glyph: 'ti-test-pipe',   desc: 'Test suite or spec file'          },
  shared:    { color: '#555', bg: '#f5f5f5', label: 'Shared',    glyph: 'ti-puzzle',      desc: 'Cross-domain shared module'       },
  default:   { color: '#888', bg: '#f5f5f5', label: 'Module',    glyph: 'ti-file-code-2', desc: 'Standard code module'             },
};