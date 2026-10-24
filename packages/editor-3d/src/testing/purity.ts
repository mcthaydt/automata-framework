// What the pure layers must not use (ED3D-D1): UI and platform imports, DOM globals, the wall clock, timers, randomness.
const FORBIDDEN_IMPORT = /from\s+['"](svelte(?:\/[^'"]*)?|typescript|effect(?:\/[^'"]*)?|node:[^'"]*)['"]/
// A DOM global is a bare name: after a dot, in quotes or as a member key (`window?: WindowDef`) it is just a word.
const FORBIDDEN_NAME = new RegExp(
  [
    '\\b(?:Date|setTimeout|setInterval|clearTimeout|clearInterval|requestAnimationFrame|queueMicrotask)\\b',
    '(?<![.\\w\'"])(?:document|window|navigator|localStorage|sessionStorage|indexedDB)\\b(?!\\s*\\??:)',
    '\\bperformance\\.now\\b',
    '\\bMath\\.random\\b',
  ].join('|'),
)

/**
 * The source without its comments and, when `withStrings` is false, without the text of its strings and templates (the
 * quotes stay): a sentence for the person that names a global is not a finding, and neither is a comment. The code of
 * a template's `${}` is code and stays, as does whatever follows a string.
 */
function strip(source: string, withStrings: boolean): string {
  let out = ''
  const expressions: number[] = [] // the brace depth inside each template `${}` that is open
  let quote: string | undefined
  for (let i = 0; i < source.length; i++) {
    const c = source[i] as string
    if (quote !== undefined) {
      if (c === '\\') {
        if (withStrings) out += c + (source[i + 1] ?? '')
        i++
      } else if (c === quote) {
        quote = undefined
        out += c
      } else if (quote === '`' && c === '$' && source[i + 1] === '{') {
        expressions.push(0)
        quote = undefined
        out += '${'
        i++
      } else if (withStrings) out += c
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++
      out += '\n'
    } else if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      i = end < 0 ? source.length : end + 1
    } else if (c === "'" || c === '"' || c === '`') {
      quote = c
      out += c
    } else if (c === '}' && expressions.at(-1) === 0) {
      expressions.pop()
      quote = '`'
      out += c
    } else {
      const open = expressions.at(-1)
      if (open !== undefined && c === '{') expressions[expressions.length - 1] = open + 1
      if (open !== undefined && c === '}') expressions[expressions.length - 1] = open - 1
      out += c
    }
  }
  return out
}

export function findImpurities(source: string): string[] {
  const findings: string[] = []
  const imports = strip(source, true).split('\n')
  const names = strip(source, false).split('\n')
  for (const [i, line] of imports.entries()) {
    const found = FORBIDDEN_IMPORT.exec(line) ?? FORBIDDEN_NAME.exec(names[i] ?? '')
    if (found) findings.push(found[0])
  }
  return findings
}
