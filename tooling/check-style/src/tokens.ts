import type { StyleFinding } from './style.ts'

// An editor reads its colours, spaces and corners from the kit's tokens (`tokens.css`). A `var(--x)` that nothing defines
// resolves to nothing at run time, so the property silently falls back to its default; the fallback after the comma hides
// it. This rule finds those names. A name counts as defined when the kit defines it or the file itself does (in a
// stylesheet, a `style="--x: …"` or a `style:--x={…}` directive).

const DEFINITION = /(?<![\w-])(--[a-zA-Z0-9-]+)\s*:|\bstyle:(--[a-zA-Z0-9-]+)/g
const USE = /\bvar\(\s*(--[a-zA-Z0-9-]+)/g

/** Every custom property a text defines. */
export function definedTokens(code: string): ReadonlySet<string> {
  const names = new Set<string>()
  for (const match of code.matchAll(DEFINITION)) names.add((match[1] ?? match[2]) as string)
  return names
}

/** One finding per use of a custom property that neither `known` nor the file defines. */
export function findUnknownTokens(file: string, code: string, known: ReadonlySet<string>): StyleFinding[] {
  const own = definedTokens(code)
  const findings: StyleFinding[] = []
  code.split('\n').forEach((text, index) => {
    for (const match of text.matchAll(USE)) {
      const name = match[1] as string
      if (known.has(name) || own.has(name)) continue
      findings.push({
        file,
        rule: 'unknown-token',
        message: `${name} is not a kit token. Use one from tokens.css, or define it where it is used.`,
        line: index + 1,
      })
    }
  })
  return findings
}
