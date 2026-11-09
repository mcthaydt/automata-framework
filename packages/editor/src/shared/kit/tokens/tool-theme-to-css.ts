import type { ToolTheme } from './editor-tokens'

const HEADER =
  '/* Generated from src/shared/kit/tokens/tool-theme.json by scripts/generate-tokens.ts. Do not edit. */'

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
/** A colour a script can read back as a colour: `#rrggbb` or `rgb(r g b)` / `rgb(r g b / a)`. */
const COLOUR = /^(#[0-9a-f]{6}|rgb\(\d+ \d+ \d+( \/ [\d.]+)?\))$/

function declarations(values: Readonly<Record<string, string>>, indent: string): string {
  return Object.entries(values)
    .map(([name, value]) => `${indent}--${name}: ${value};`)
    .join('\n')
}

/**
 * Renders the two looks as plain values, not `light-dark()`: a script that reads a token with `getPropertyValue` (the
 * level canvas) gets a colour in either look, and older iPads draw it. `:root` holds the light values and
 * `color-scheme: light dark`; the dark values are written twice, once for a device set to dark (unless the page forces
 * light) and once for a forced `data-theme="dark"`. Pure and deterministic, so the CSS can be checked byte for byte.
 * It refuses a key in one look only, a bad name and a value that is not a plain colour (a shadow or a mix is built from
 * these in `tool-chrome.css`, never stored here).
 */
export function toolThemeToCss({ light, dark }: ToolTheme): string {
  const names = Object.keys(light)
  for (const name of Object.keys(dark)) {
    if (!(name in light)) throw new Error(`"${name}" is in dark and not in light`)
  }
  for (const name of names) {
    if (!NAME.test(name)) throw new Error(`bad token name "${name}"`)
    if (!(name in dark)) throw new Error(`"${name}" is in light and not in dark`)
    for (const value of [light[name], dark[name]]) {
      if (value === undefined || !COLOUR.test(value))
        throw new Error(`"${name}" is not a plain colour: ${value}`)
    }
  }
  return `${HEADER}
:root {
  color-scheme: light dark;
${declarations(light, '  ')}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
${declarations(dark, '    ')}
  }
}
:root[data-theme="light"] {
  color-scheme: light;
}
:root[data-theme="dark"] {
  color-scheme: dark;
${declarations(dark, '  ')}
}
`
}
