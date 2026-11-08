import { parse as parseToml, stringify as stringifyToml } from 'smol-toml'
import { mergeLines } from './line-merge.ts'

// How the app merges a file that changed both here and on GitHub (you in the app, Claude Code on a branch). A TOML or
// JSON file merges by key, and a list of tables by the table's `id` or `on`, so a person's flash and Claude's shake
// land in one file. Other text merges by lines. A picture or other bytes cannot merge. Whatever cannot merge is
// handed back as a question for the person, and no conflict marker is ever written into a file.

export interface Versions {
  /** The file where the two sides last agreed; absent when both added it. */
  readonly base?: Uint8Array
  /** The file in the app; absent when it was deleted here. */
  readonly mine?: Uint8Array
  /** The file on GitHub; absent when it was deleted there. */
  readonly theirs?: Uint8Array
}

export type AskReason = 'both-changed' | 'deleted-here' | 'deleted-there'

export type MergeOutcome =
  | { readonly kind: 'merged'; readonly data: Uint8Array | string }
  | { readonly kind: 'deleted' }
  | {
      readonly kind: 'ask'
      readonly reason: AskReason
      /** The key the two sides disagree about, for a structured file. */
      readonly where?: string
      /** Where "Keep both" puts GitHub's copy, for a file that cannot merge. */
      readonly keepBothPath?: string
    }

const strict = new TextDecoder('utf-8', { fatal: true })
const encoder = new TextEncoder()

const sameBytes = (a: Uint8Array | undefined, b: Uint8Array | undefined): boolean =>
  a === b ||
  (a !== undefined && b !== undefined && a.length === b.length && a.every((byte, i) => byte === b[i]))

type Plain = unknown
type Merged = { readonly ok: true; readonly value: Plain } | { readonly ok: false; readonly where: string }

const isTable = (value: Plain): value is Record<string, Plain> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)

function same(a: Plain, b: Plain): boolean {
  if (a === b) return true
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime()
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, i) => same(item, b[i]))
  if (isTable(a) && isTable(b)) {
    const keys = Object.keys(a)
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && same(a[key], b[key]))
  }
  return false
}

/** The key that names a table in a list, when every table in all three lists has the same one and no two share it. */
function identityKey(lists: readonly (readonly Plain[])[]): 'id' | 'on' | undefined {
  for (const key of ['id', 'on'] as const) {
    const fits = lists.every((list) => {
      const seen = new Set<unknown>()
      return list.every((item) => {
        if (!isTable(item) || (typeof item[key] !== 'string' && typeof item[key] !== 'number')) return false
        if (seen.has(item[key])) return false
        seen.add(item[key])
        return true
      })
    })
    if (fits) return key
  }
  return undefined
}

const at = (path: string, key: string | number): string => (path === '' ? String(key) : `${path}.${key}`)

function mergeTables(
  base: Record<string, Plain>,
  mine: Record<string, Plain>,
  theirs: Record<string, Plain>,
  path: string,
): Merged {
  const out: Record<string, Plain> = {}
  for (const key of [...Object.keys(mine), ...Object.keys(theirs).filter((each) => !(each in mine))]) {
    const inMine = key in mine
    const inTheirs = key in theirs
    const inBase = key in base
    if (inMine && inTheirs) {
      const merged = mergeValue(inBase ? base[key] : undefined, mine[key], theirs[key], at(path, key))
      if (!merged.ok) return merged
      out[key] = merged.value
    } else if (inMine) {
      if (inBase && !same(base[key], mine[key])) return { ok: false, where: at(path, key) }
      if (!inBase) out[key] = mine[key]
    } else {
      if (inBase && !same(base[key], theirs[key])) return { ok: false, where: at(path, key) }
      if (!inBase) out[key] = theirs[key]
    }
  }
  return { ok: true, value: out }
}

function mergeLists(
  base: readonly Plain[],
  mine: readonly Plain[],
  theirs: readonly Plain[],
  key: 'id' | 'on',
  path: string,
): Merged {
  const byKey = (list: readonly Plain[]) =>
    new Map(list.map((item) => [(item as Record<string, unknown>)[key], item]))
  const baseBy = byKey(base)
  const mineBy = byKey(mine)
  const theirBy = byKey(theirs)
  const out: Plain[] = []
  for (const [name, item] of mineBy) {
    const where = at(path, `${key}=${String(name)}`)
    if (theirBy.has(name)) {
      const merged = mergeValue(baseBy.get(name), item, theirBy.get(name), where)
      if (!merged.ok) return merged
      out.push(merged.value)
    } else if (baseBy.has(name)) {
      if (!same(baseBy.get(name), item)) return { ok: false, where }
    } else out.push(item)
  }
  for (const [name, item] of theirBy) {
    if (mineBy.has(name)) continue
    const where = at(path, `${key}=${String(name)}`)
    if (baseBy.has(name)) {
      if (!same(baseBy.get(name), item)) return { ok: false, where }
    } else out.push(item)
  }
  return { ok: true, value: out }
}

function mergeValue(base: Plain, mine: Plain, theirs: Plain, path: string): Merged {
  if (same(mine, theirs) || same(base, theirs)) return { ok: true, value: mine }
  if (same(base, mine)) return { ok: true, value: theirs }
  if (isTable(mine) && isTable(theirs)) return mergeTables(isTable(base) ? base : {}, mine, theirs, path)
  if (Array.isArray(mine) && Array.isArray(theirs)) {
    const baseList = Array.isArray(base) ? base : []
    const key = identityKey([baseList, mine, theirs])
    if (key !== undefined) return mergeLists(baseList, mine, theirs, key, path)
  }
  return { ok: false, where: path }
}

type Format = 'toml' | 'json'

const formatOf = (path: string): Format | undefined =>
  path.endsWith('.toml') ? 'toml' : path.endsWith('.json') ? 'json' : undefined

/** The text as a value, or `undefined` when it does not parse. An absent file is an empty table. */
function parseText(format: Format, text: string | undefined): Plain {
  if (text === undefined) return {}
  try {
    return format === 'toml' ? parseToml(text) : JSON.parse(text)
  } catch {
    return undefined
  }
}

function writeText(format: Format, value: Plain, like: string): string {
  if (format === 'toml') return `${stringifyToml(value as Record<string, unknown>).trimEnd()}\n`
  const indent = /^\{?\s*\n([ \t]+)\S/.exec(like)?.[1] ?? '  '
  return JSON.stringify(value, null, indent) + (like.endsWith('\n') ? '\n' : '')
}

/** `art/hero.png` as `art/hero-github.png`: where GitHub's copy goes when the person keeps both. */
export function keepBothName(path: string): string {
  const dot = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  return dot > slash + 1 ? `${path.slice(0, dot)}-github${path.slice(dot)}` : `${path}-github`
}

/** The bytes as text, or `undefined` for anything that is not plain UTF-8 text (a picture, a sound). */
function textOf(data: Uint8Array): string | undefined {
  try {
    const text = strict.decode(data)
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are the sign of bytes, not text.
    return /[\u0000-\u0008\u000e-\u001f]/.test(text) ? undefined : text
  } catch {
    return undefined
  }
}

/** Merges one file's three versions. */
export function mergeFile(path: string, { base, mine, theirs }: Versions): MergeOutcome {
  if (sameBytes(mine, theirs))
    return mine === undefined ? { kind: 'deleted' } : { kind: 'merged', data: mine }
  if (sameBytes(base, mine))
    return theirs === undefined ? { kind: 'deleted' } : { kind: 'merged', data: theirs }
  if (sameBytes(base, theirs))
    return mine === undefined ? { kind: 'deleted' } : { kind: 'merged', data: mine }
  if (mine === undefined) return { kind: 'ask', reason: 'deleted-here' }
  if (theirs === undefined) return { kind: 'ask', reason: 'deleted-there' }

  const cannot: MergeOutcome = { kind: 'ask', reason: 'both-changed', keepBothPath: keepBothName(path) }
  const mineText = textOf(mine)
  const theirText = textOf(theirs)
  const baseText = base === undefined ? undefined : textOf(base)
  if (mineText === undefined || theirText === undefined || (base !== undefined && baseText === undefined))
    return cannot
  const byLines = baseText === undefined ? undefined : mergeLines(baseText, mineText, theirText)

  const format = formatOf(path)
  if (format === undefined)
    return byLines === undefined ? { kind: 'ask', reason: 'both-changed' } : { kind: 'merged', data: byLines }

  const parsed = [parseText(format, baseText), parseText(format, mineText), parseText(format, theirText)]
  if (parsed.some((value) => value === undefined)) return { kind: 'ask', reason: 'both-changed' }
  const merged = mergeValue(parsed[0], parsed[1], parsed[2], '')
  if (!merged.ok) return { kind: 'ask', reason: 'both-changed', where: merged.where }
  // Lines first, because they keep comments; used only when they agree with the merge by key.
  if (byLines !== undefined && same(parseText(format, byLines), merged.value))
    return { kind: 'merged', data: byLines }
  return { kind: 'merged', data: encoder.encode(writeText(format, merged.value, mineText)) }
}
