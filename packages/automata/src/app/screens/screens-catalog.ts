// The default screens' words as message catalogs, so one workflow (`automata words`) translates core, the extensions
// and every game the same way. The English TypeScript records stay the source: `words/en.json` is derived from them and
// a test fails when it is stale. A catalog is flat, `key -> text`, in the inlang message format the tools already read;
// a word that needs a number or a name carries it as a `{placeholder}`.

import { DEFAULT_LOCALES, type DefaultLocale } from '@automata/content/locale'
import { DISPLAY_COPY_EN, type DisplayCopy } from '../../features/display/display-policy.svelte.ts'
import { matchLocale } from '../../features/locale/negotiate-locale.ts'
import { BOOT_FAILURE_COPY_EN, type BootFailureCopy } from '../../shared/ui/status/boot-failure.ts'
import type { ScreensCopy } from './screens-copy.ts'
import en from './words/en.json' with { type: 'json' }
import es419 from './words/es-419.json' with { type: 'json' }
import ja from './words/ja.json' with { type: 'json' }
import ko from './words/ko.json' with { type: 'json' }
import ptBR from './words/pt-BR.json' with { type: 'json' }
import zhHans from './words/zh-Hans.json' with { type: 'json' }

/** A catalog: message key to text. */
export type Catalog = Readonly<Record<string, string>>

/** The inlang schema line every catalog file starts with. */
export const CATALOG_SCHEMA = 'https://inlang.com/schema/inlang-message-format'

// ---- Keys ----

/** `settings.screen.moreCount` and `saves.status.offline-queued` become `settings_screen_more_count` and `saves_status_offline_queued`. */
const snake = (segment: string): string =>
  segment
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/-/g, '_')
    .toLowerCase()

/** A record's path as a catalog key, under an optional prefix. */
export const catalogKey = (path: readonly string[], prefix = ''): string =>
  [...(prefix === '' ? [] : [prefix]), ...path.map(snake)].join('_')

// ---- Words that are functions ----

/**
 * A word the screens compute from arguments. Its catalog text carries the arguments as `{name}` placeholders, filled
 * by `prepare`, which turns the call's arguments into each placeholder's text.
 */
interface FunctionLeaf {
  /** The record path, dotted: `settings.controls.rebind`. */
  readonly path: string
  /** Names for each argument, in order, or `'boolean'` for a word that reads one of two ways (keys `_on` and `_off`). */
  readonly params: readonly string[] | 'boolean'
  /**
   * The English text, written out where the English function computes its argument and so cannot be read by calling it
   * with the placeholders themselves.
   */
  readonly text?: string
  /** Placeholder values from the call's arguments; by default each argument as text. */
  readonly prepare?: (args: readonly unknown[]) => Readonly<Record<string, string>>
}

const asText = (args: readonly unknown[], names: readonly string[]): Record<string, string> =>
  Object.fromEntries(names.map((name, index) => [name, String(args[index])]))

/**
 * Every function in `ScreensCopy`. `flattenScreensCopy` refuses a function that is not here, so a new one cannot
 * slip past the catalogs.
 */
export const FUNCTION_LEAVES: readonly FunctionLeaf[] = [
  { path: 'settings.screen.more', params: ['count'] },
  { path: 'settings.controls.rebind', params: ['action', 'device'] },
  {
    path: 'settings.controls.capturing',
    params: ['action', 'device', 'seconds'],
    text: 'Press a new {device} button for {action}. {seconds} seconds left. Escape cancels.',
    // The device sits mid-sentence, so it is lower-cased; the languages that do not capitalize it are unaffected.
    prepare: ([action, device, seconds]) => ({
      action: String(action),
      device: String(device).toLocaleLowerCase(),
      seconds: String(seconds),
    }),
  },
  { path: 'settings.controls.conflict', params: ['action', 'other'] },
  { path: 'settings.controls.reserved', params: ['action'] },
  { path: 'settings.controls.timedOut', params: ['action'] },
  { path: 'settings.controls.saved', params: ['action'] },
  {
    path: 'settings.audio.percent',
    params: ['percent'],
    text: '{percent}%',
    prepare: ([value]) => ({ percent: String(Math.round(Number(value) * 100)) }),
  },
  { path: 'settings.display.reducedMotion', params: 'boolean' },
  {
    path: 'saves.slots.slot',
    params: ['number'],
    text: 'Slot {number}',
    prepare: ([slot]) => ({ number: String(Number(slot) + 1) }),
  },
  { path: 'saves.slots.deleteBody', params: ['name'] },
  { path: 'saves.slots.more', params: ['count'] },
  { path: 'board.more', params: ['count'] },
  { path: 'firstRun.warning.declared', params: ['effects'] },
]

const leafAt = (path: string): FunctionLeaf | undefined => FUNCTION_LEAVES.find((leaf) => leaf.path === path)

/** Fills `{name}` slots; a slot with no value stays as written, so a missing argument is visible. */
export function fillSlots(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(/\{(\w+)\}/g, (slot, name: string) => values[name] ?? slot)
}

// ---- Record to catalog ----

type Tree = { readonly [key: string]: unknown }

const isTree = (value: unknown): value is Tree => value !== null && typeof value === 'object'

/** Adds a key, refusing two paths that flatten to the same one. */
function put(out: Record<string, string>, key: string, text: string): void {
  if (key in out) throw new Error(`Two words flatten to the catalog key "${key}"`)
  out[key] = text
}

/** The English text of a function word: its hand-written text, or the function called with `{name}` placeholders. */
function textOf(leaf: FunctionLeaf, fn: (...args: unknown[]) => string): string | readonly [string, string] {
  if (leaf.params === 'boolean') return [fn(true), fn(false)]
  if (leaf.text !== undefined) return leaf.text
  return fn(...leaf.params.map((name) => `{${name}}`))
}

/**
 * A `ScreensCopy` as a catalog. A function word becomes text with `{placeholders}`, and a word that reads one of two
 * ways becomes two keys ending `_on` and `_off`.
 */
export function flattenScreensCopy(copy: ScreensCopy): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (node: Tree, path: readonly string[]): void => {
    for (const [name, value] of Object.entries(node)) {
      const here = [...path, name]
      const dotted = here.join('.')
      if (typeof value === 'string') put(out, catalogKey(here), value)
      else if (typeof value === 'function') {
        const leaf = leafAt(dotted)
        if (leaf === undefined) throw new Error(`The function word "${dotted}" is not in FUNCTION_LEAVES`)
        const text = textOf(leaf, value as (...args: unknown[]) => string)
        if (typeof text === 'string') put(out, catalogKey(here), text)
        else {
          put(out, `${catalogKey(here)}_on`, text[0])
          put(out, `${catalogKey(here)}_off`, text[1])
        }
      } else if (isTree(value)) walk(value, here)
    }
  }
  walk(copy as unknown as Tree, [])
  return out
}

/** A record of plain words (no functions) as a catalog under a prefix: `display_toast_ok`. */
export function flattenWords(words: Tree, prefix: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (node: Tree, path: readonly string[]): void => {
    for (const [name, value] of Object.entries(node)) {
      if (typeof value === 'string') put(out, catalogKey([...path, name], prefix), value)
      else if (isTree(value)) walk(value, [...path, name])
    }
  }
  walk(words, [])
  return out
}

// ---- Catalog to record ----

/**
 * The reverse of `flattenScreensCopy`: `fallback`'s record with each word the catalog has put in its place. A key the
 * catalog lacks keeps `fallback`'s word, so a half-translated catalog never shows a blank.
 */
export function screensCopyFrom(catalog: Catalog, fallback: ScreensCopy): ScreensCopy {
  const build = (node: Tree, path: readonly string[]): Tree => {
    const out: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(node)) {
      const here = [...path, name]
      const key = catalogKey(here)
      if (typeof value === 'string') out[name] = catalog[key] ?? value
      else if (typeof value === 'function')
        out[name] = functionWord(here.join('.'), key, value as (...args: never[]) => string)
      else if (isTree(value)) out[name] = build(value, here)
      else out[name] = value
    }
    return out
  }
  const functionWord = (dotted: string, key: string, original: (...args: never[]) => string) => {
    const leaf = leafAt(dotted)
    const fallbackWord = original as unknown as (...args: unknown[]) => string
    if (leaf === undefined) return fallbackWord
    if (leaf.params === 'boolean') {
      return (on: boolean): string => catalog[`${key}_${on ? 'on' : 'off'}`] ?? fallbackWord(on)
    }
    const names = leaf.params
    return (...args: unknown[]): string => {
      const text = catalog[key]
      if (text === undefined) return fallbackWord(...args)
      return fillSlots(text, leaf.prepare?.(args) ?? asText(args, names))
    }
  }
  return build(fallback as unknown as Tree, []) as unknown as ScreensCopy
}

// ---- The runtime and display words ----

/** The runtime's own words: every boot failure and action, and the loader and lost-picture lines. */
export type RuntimeCopy = BootFailureCopy & {
  readonly loading: string
  readonly slow: string
  /** The panel when the renderer's graphics context is lost for good. */
  readonly contextLost: string
}

/** The runtime's English words. The boot failure defaults live with the panel that draws them. */
export const RUNTIME_COPY_EN: RuntimeCopy = {
  ...BOOT_FAILURE_COPY_EN,
  loading: 'Loading…',
  slow: 'Taking a while…',
  contextLost: 'The picture stopped. Try again to bring it back.',
}

/** The runtime's words as catalog keys, `runtime_start_final`. */
export const flattenRuntimeCopy = (copy: RuntimeCopy): Record<string, string> => flattenWords(copy, 'runtime')

/** The display policy's words as catalog keys, `display_gate_title`. */
export const flattenDisplayCopy = (copy: DisplayCopy): Record<string, string> =>
  flattenWords(copy as unknown as Tree, 'display')

/** Every word core owns, in English, as the catalog `words/en.json` holds it. */
export function englishCatalog(screens: ScreensCopy): Record<string, string> {
  return {
    ...flattenScreensCopy(screens),
    ...flattenRuntimeCopy(RUNTIME_COPY_EN),
    ...flattenDisplayCopy(DISPLAY_COPY_EN),
  }
}

/** `runtimeCopyFor` and `displayCopyFor`, given the catalog for a locale. */
export function runtimeCopyFrom(catalog: Catalog): RuntimeCopy {
  const out: Record<string, string> = {}
  for (const [name, english] of Object.entries(RUNTIME_COPY_EN)) {
    out[name] = catalog[catalogKey([name], 'runtime')] ?? english
  }
  return out as unknown as RuntimeCopy
}

export function displayCopyFrom(catalog: Catalog): DisplayCopy {
  const build = (node: Tree, path: readonly string[]): Tree =>
    Object.fromEntries(
      Object.entries(node).map(([name, value]) => [
        name,
        isTree(value)
          ? build(value, [...path, name])
          : (catalog[catalogKey([...path, name], 'display')] ?? value),
      ]),
    )
  return build(DISPLAY_COPY_EN as unknown as Tree, []) as unknown as DisplayCopy
}

// ---- The shipped catalogs ----

/** The catalogs bundled with core: all six ship, because a language switch must be instant and work offline. */
const CATALOGS: Readonly<Record<DefaultLocale, Catalog>> = {
  en,
  ja,
  ko,
  'es-419': es419,
  'pt-BR': ptBR,
  'zh-Hans': zhHans,
}

/** The bundled catalog for a locale tag (`pt-PT` finds `pt-BR`), or undefined for a language core has no words in. */
export function catalogFor(locale: string): Catalog | undefined {
  const tag = matchLocale(locale, DEFAULT_LOCALES)
  return tag === undefined ? undefined : CATALOGS[tag as DefaultLocale]
}

const runtimeCache = new Map<string, RuntimeCopy>()
const displayCache = new Map<string, DisplayCopy>()

/** The failure, loading and lost-picture words in a locale; English for a language core has no words in. */
export function runtimeCopyFor(locale: string): RuntimeCopy {
  const catalog = catalogFor(locale)
  if (catalog === undefined) return RUNTIME_COPY_EN
  const cached = runtimeCache.get(locale)
  if (cached !== undefined) return cached
  const built = runtimeCopyFrom(catalog)
  runtimeCache.set(locale, built)
  return built
}

/** The landscape gate's, the rotate hint's and the rotate toast's words in a locale. */
export function displayCopyFor(locale: string): DisplayCopy {
  const catalog = catalogFor(locale)
  if (catalog === undefined) return DISPLAY_COPY_EN
  const cached = displayCache.get(locale)
  if (cached !== undefined) return cached
  const built = displayCopyFrom(catalog)
  displayCache.set(locale, built)
  return built
}
