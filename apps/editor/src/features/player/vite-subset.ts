// The part of Vite that a game's own files use, run as plain text edits so a phone can play a game with no Vite:
// where a module names another, the build constants, `import.meta.glob` for urls, and the plugins a config lists.
// It reads source the way a person would skim it: comments and the inside of strings are set aside first, so a
// word in either never counts. It is not a parser. A file it cannot read this way is a rare one, and the app says
// "play it on a computer" for any game it is unsure of.

export interface Edit {
  readonly start: number
  readonly end: number
  readonly text: string
}

/** The source with its edits applied. Edits never overlap; they are applied last first so offsets stay right. */
export function applyEdits(source: string, edits: readonly Edit[]): string {
  let out = source
  for (const edit of [...edits].sort((a, b) => b.start - a.start))
    out = out.slice(0, edit.start) + edit.text + out.slice(edit.end)
  return out
}

/**
 * The source with comments and the inside of strings and templates blanked to spaces, so every offset is the same
 * as in the source. The quotes stay: a specifier's position is found here and its text read from the source.
 */
export function maskCode(source: string): string {
  const out: string[] = []
  let i = 0
  const blank = (from: number, to: number): void => {
    for (let at = from; at < to; at++) out.push(source[at] === '\n' ? '\n' : ' ')
  }
  while (i < source.length) {
    const char = source[i] as string
    const next = source[i + 1]
    if (char === '/' && next === '/') {
      let end = source.indexOf('\n', i)
      if (end < 0) end = source.length
      blank(i, end)
      i = end
    } else if (char === '/' && next === '*') {
      let end = source.indexOf('*/', i + 2)
      end = end < 0 ? source.length : end + 2
      blank(i, end)
      i = end
    } else if (char === "'" || char === '"' || char === '`') {
      let end = i + 1
      while (end < source.length && source[end] !== char) end += source[end] === '\\' ? 2 : 1
      out.push(char)
      blank(i + 1, Math.min(end, source.length))
      if (end < source.length) out.push(char)
      i = end + 1
    } else {
      out.push(char)
      i++
    }
  }
  return out.join('')
}

export interface Specifier {
  /** What the module wrote between the quotes. */
  readonly value: string
  /** The offsets of `value` in the source (not the quotes). */
  readonly start: number
  readonly end: number
  /** `side-effect` is `import 'x'`, which names no bindings and can be taken out whole. */
  readonly kind: 'static' | 'side-effect' | 'dynamic'
  /** The whole `import 'x'` statement, with a trailing semicolon, for removing a side-effect import. */
  readonly statementStart: number
  readonly statementEnd: number
}

const TYPE_ONLY = /^(?:import|export)\s+type\s+(?!from\b)[\w{*$]/

/** Every specifier a module imports or re-exports for its value; type-only ones are erased by the compile. */
export function scanSpecifiers(source: string): Specifier[] {
  const code = maskCode(source)
  const found: Specifier[] = []

  const close = (open: number): number => source.indexOf(source[open] as string, open + 1)

  for (const match of code.matchAll(/\bfrom\s*(['"])/g)) {
    const quote = match.index + match[0].length - 1
    const head = code.slice(0, match.index)
    const keyword = [...head.matchAll(/\b(import|export)\b/g)].at(-1)
    if (keyword === undefined || /[;'"`]/.test(head.slice(keyword.index))) continue
    if (TYPE_ONLY.test(code.slice(keyword.index, match.index + 4))) continue
    const end = close(quote)
    if (end < 0) continue
    found.push({
      value: source.slice(quote + 1, end),
      start: quote + 1,
      end,
      kind: 'static',
      statementStart: keyword.index,
      statementEnd: end + 1,
    })
  }

  for (const match of code.matchAll(/\bimport\s*(['"])/g)) {
    const quote = match.index + match[0].length - 1
    const end = close(quote)
    if (end < 0) continue
    const after = source[end + 1] === ';' ? end + 2 : end + 1
    found.push({
      value: source.slice(quote + 1, end),
      start: quote + 1,
      end,
      kind: 'side-effect',
      statementStart: match.index,
      statementEnd: after,
    })
  }

  for (const match of code.matchAll(/\bimport\s*\(\s*(['"])/g)) {
    const quote = match.index + match[0].length - 1
    const end = close(quote)
    if (end < 0) continue
    found.push({
      value: source.slice(quote + 1, end),
      start: quote + 1,
      end,
      kind: 'dynamic',
      statementStart: match.index,
      statementEnd: end + 1,
    })
  }

  return found.sort((a, b) => a.start - b.start)
}

/** What Vite's dev page gives a module for its build constants. */
const ENV: Readonly<Record<string, string>> = {
  DEV: 'true',
  PROD: 'false',
  SSR: 'false',
  MODE: '"development"',
  BASE_URL: '"./"',
}

/** `__AUTOMATA_DEBUG__` off, `import.meta.env` as a dev page has it, `import.meta.hot` undefined (nothing reloads). */
export function buildConstantEdits(source: string): Edit[] {
  const code = maskCode(source)
  const edits: Edit[] = []
  for (const match of code.matchAll(/\b__AUTOMATA_DEBUG__\b/g))
    edits.push({ start: match.index, end: match.index + match[0].length, text: 'false' })
  for (const match of code.matchAll(/\bimport\.meta\.hot\b/g))
    edits.push({ start: match.index, end: match.index + match[0].length, text: 'undefined' })
  for (const match of code.matchAll(/\bimport\.meta\.env(?:\.([A-Za-z_]\w*))?/g)) {
    const name = match[1]
    const text =
      name === undefined
        ? `{ ${Object.entries(ENV)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ')} }`
        : (ENV[name] ?? 'undefined')
    edits.push({ start: match.index, end: match.index + match[0].length, text })
  }
  return edits
}

export interface GlobCall {
  readonly start: number
  readonly end: number
  readonly pattern: string
  /** Whether it is `{ eager: true, query: '?url' }`, the one form a game with pictures and sounds uses. */
  readonly supported: boolean
}

/** Every `import.meta.glob(...)` call. */
export function findGlobs(source: string): GlobCall[] {
  const code = maskCode(source)
  const calls: GlobCall[] = []
  for (const match of code.matchAll(/\bimport\.meta\.glob\s*\(/g)) {
    const open = match.index + match[0].length - 1
    const end = matching(code, open, '(', ')')
    if (end < 0) continue
    const inner = source.slice(open + 1, end)
    const pattern = /^\s*(['"])(.*?)\1/s.exec(inner)?.[2]
    if (pattern === undefined) continue
    const options = inner.slice(inner.indexOf(pattern) + pattern.length + 1)
    calls.push({
      start: match.index,
      end: end + 1,
      pattern,
      supported: /\beager\s*:\s*true\b/.test(options) && /\bquery\s*:\s*['"]\?url['"]/.test(options),
    })
  }
  return calls
}

/** A glob as the path test it means: `*` within a folder, `**` across folders, `?` one character, `{a,b}`. */
export function globToRegExp(pattern: string): RegExp {
  let out = ''
  let braces = 0
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i] as string
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        i += pattern[i + 2] === '/' ? 2 : 1
        out += '(?:.*/)?'
      } else out += '[^/]*'
    } else if (char === '?') out += '[^/]'
    else if (char === '{') {
      braces++
      out += '(?:'
    } else if (char === '}' && braces > 0) {
      braces--
      out += ')'
    } else if (char === ',' && braces > 0) out += '|'
    else out += char.replace(/[.+^$()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${out}$`)
}

/** The offset of the bracket that closes the one at `open`, or -1. `code` has its strings and comments blanked. */
function matching(code: string, open: number, up: string, down: string): number {
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === up) depth++
    else if (code[i] === down && --depth === 0) return i
  }
  return -1
}

/**
 * What a Vite config puts in `plugins: [...]`: each entry's name (`svelte()` is `svelte`), or its text when it is not
 * a call or a name (a spread). No `plugins` array is no plugins.
 */
export function pluginsOf(config: string): string[] {
  const code = maskCode(config)
  const start = /\bplugins\s*:\s*\[/.exec(code)
  if (start === null) return []
  const open = start.index + start[0].length - 1
  const close = matching(code, open, '[', ']')
  if (close < 0) return []
  const entries: string[] = []
  let depth = 0
  let from = open + 1
  for (let i = open + 1; i <= close; i++) {
    const char = code[i] as string
    if ('([{'.includes(char)) depth++
    else if (')]}'.includes(char) && i < close) depth--
    else if ((char === ',' && depth === 0) || i === close) {
      const text = code.slice(from, i).trim()
      if (text !== '') entries.push(/^[A-Za-z_$][\w$]*/.exec(text)?.[0] ?? text)
      from = i + 1
    }
  }
  return entries
}

/** The text of `function name(...) { ... }` in `source`, or `undefined` when the file has no such function. */
export function functionBody(source: string, name: string): string | undefined {
  const code = maskCode(source)
  const start = new RegExp(`\\bfunction\\s+${name}\\b`).exec(code)
  if (start === null) return undefined
  const open = code.indexOf('{', start.index + start[0].length)
  if (open < 0) return undefined
  const close = matching(code, open, '{', '}')
  return close < 0 ? undefined : source.slice(open, close + 1)
}
