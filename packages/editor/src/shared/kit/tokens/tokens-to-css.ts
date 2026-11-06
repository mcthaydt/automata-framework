import type { EditorTokens } from './editor-tokens'

const HEADER =
  '/* Generated from src/shared/kit/tokens/tokens.json by scripts/generate-tokens.ts. Do not edit. */'

/** A plain custom property name: lowercase words and digits joined by hyphens. */
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/

function checkName(name: string): void {
  if (!NAME.test(name)) throw new Error(`bad token name "${name}"`)
}

/**
 * Renders the tokens as a do-not-edit header and one `:root` block: the color scheme, every token, then every
 * alias as `var()` of its token. Pure and deterministic, so `tokens.css` can be checked against it byte for byte.
 * It refuses a name that is not a plain custom property name, an alias to a missing token and a name defined twice,
 * because each would be a silent `unset` in the browser.
 */
export function tokensToCss({ colorScheme, tokens, aliases }: EditorTokens): string {
  const lines = [`color-scheme: ${colorScheme};`]
  for (const [name, value] of Object.entries(tokens)) {
    checkName(name)
    lines.push(`--${name}: ${value};`)
  }
  for (const [name, target] of Object.entries(aliases)) {
    checkName(name)
    if (name in tokens) throw new Error(`"${name}" is both a token and an alias`)
    if (!(target in tokens)) throw new Error(`alias "${name}" points at "${target}", which is not a token`)
    lines.push(`--${name}: var(--${target});`)
  }
  return `${HEADER}\n:root {\n${lines.map((line) => `  ${line}`).join('\n')}\n}\n`
}
