// ─── REPOGAMI DESIGN SYSTEM ───────────────────────────────────────────────────
// Aesthetic: Obsidian Precision — dark, surgical, data-dense
// Inspired by: Linear, Raycast, Vercel, Warp terminal

export const T = {
  // Backgrounds
  bg:         '#0A0A0B',      // Near-black base
  bgElevated: '#111113',      // Panels, sidebars
  bgSurface:  '#18181B',      // Cards, inputs
  bgHover:    '#1F1F24',      // Hover states
  bgActive:   '#26262D',      // Active / selected

  // Borders
  border:     '#27272A',      // Default hairline
  borderMid:  '#3F3F46',      // Emphasis borders
  borderHi:   '#52525B',      // Highlight borders

  // Text
  text:       '#FAFAFA',      // Primary
  textMuted:  '#A1A1AA',      // Secondary
  textDim:    '#52525B',      // Tertiary / placeholder
  textInverse:'#09090B',      // Text on light

  // Accents
  cyan:       '#22D3EE',      // Sky — links, highlights
  cyanDim:    '#0E7490',      // Sky dim
  green:      '#4ADE80',      // Success
  greenDim:   '#15803D',
  amber:      '#FBBF24',      // Warning
  amberDim:   '#92400E',
  red:        '#F87171',      // Error / danger
  redDim:     '#991B1B',
  purple:     '#A78BFA',      // Special
  purpleDim:  '#5B21B6',
  pink:       '#F472B6',      // Accent
  pinkDim:    '#9D174D',

  // Typography
  // Distinctive: DM Mono for data, Instrument Serif for display moments
  sans: '"DM Sans", -apple-system, BlinkMacSystemFont, sans-serif',
  mono: '"DM Mono", "Fira Code", ui-monospace, monospace',
  serif: '"Instrument Serif", Georgia, serif',
};

export const card = {
  background: T.bgSurface,
  borderRadius: 10,
  border: `1px solid ${T.border}`,
};

export const ROLES: Record<string, { color: string; bg: string; label: string; glyph: string; desc: string }> = {
  component: { color: '#22D3EE', bg: '#0E7490', label: 'Component',  glyph: 'ti-layout-2',       desc: 'UI component or view layer' },
  util:      { color: '#A78BFA', bg: '#5B21B6', label: 'Utility',    glyph: 'ti-bolt',            desc: 'Helper functions and tools' },
  model:     { color: '#4ADE80', bg: '#15803D', label: 'Model',      glyph: 'ti-database',        desc: 'Data structure or schema' },
  api:       { color: '#F472B6', bg: '#9D174D', label: 'API',        glyph: 'ti-api',             desc: 'Network route or API endpoint' },
  config:    { color: '#FBBF24', bg: '#92400E', label: 'Config',     glyph: 'ti-settings-2',      desc: 'Configuration or environment' },
  test:      { color: '#2DD4BF', bg: '#0F766E', label: 'Test',       glyph: 'ti-test-pipe',       desc: 'Test suite or spec file' },
  shared:    { color: '#818CF8', bg: '#3730A3', label: 'Shared',     glyph: 'ti-puzzle',          desc: 'Cross-domain shared module' },
  default:   { color: '#71717A', bg: '#27272A', label: 'Module',     glyph: 'ti-file-code-2',     desc: 'Standard code module' },
};