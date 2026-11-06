import type { EditorTokens, RampEntry } from './editor-tokens'

// CSS is written the way Biome formats CSS (double quotes, spaces around the slash of `font`), so the
// generated file is already formatted and `pnpm format` leaves it alone.
const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const MONO_FALLBACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

/** Groups this renderer knows. `$comment` is a note in the JSON, not a token. */
const KNOWN_GROUPS = new Set(['$comment', 'color', 'space', 'radius', 'size', 'font'])

const HEADER =
  '/* Generated from src/shared/kit/tokens/tokens.json by scripts/generate-tokens.ts. Do not edit. */'

const px = (n: number): string => `${n}px`

function rampDeclarations(ramp: Readonly<Record<string, RampEntry>>): string[] {
  const lines: string[] = []
  for (const [name, r] of Object.entries(ramp)) {
    lines.push(`--text-${name}: ${r.weight} ${px(r.size)} / ${px(r.line)} var(--font-${r.family});`)
    lines.push(`--text-${name}-tracking: ${px(r.tracking)};`)
  }
  return lines
}

/**
 * Renders the editor tokens as a do-not-edit header and one `:root` block of custom properties. Pure and deterministic: the same tokens
 * give the same text, so `tokens.css` can be checked against it byte for byte.
 */
export function tokensToCss(tokens: EditorTokens): string {
  for (const group of Object.keys(tokens)) {
    if (!KNOWN_GROUPS.has(group)) throw new Error(`unknown token group "${group}"`)
  }
  const lines: string[] = ['color-scheme: dark;']
  for (const [group, entries] of Object.entries(tokens.color)) {
    for (const [name, value] of Object.entries(entries)) lines.push(`--color-${group}-${name}: ${value};`)
  }
  for (const [name, value] of Object.entries(tokens.space)) lines.push(`--space-${name}: ${px(value)};`)
  for (const [name, value] of Object.entries(tokens.radius)) lines.push(`--radius-${name}: ${px(value)};`)
  for (const [name, value] of Object.entries(tokens.size)) lines.push(`--size-${name}: ${px(value)};`)
  lines.push(`--font-sans: "${tokens.font.sans}", ${SANS_FALLBACK};`)
  lines.push(`--font-mono: "${tokens.font.mono}", ${MONO_FALLBACK};`)
  lines.push(...rampDeclarations(tokens.font.ramp))
  return `${HEADER}\n:root {\n${lines.map((l) => `  ${l}`).join('\n')}\n}\n`
}
