// Ruken decides what its manifest accepts, so content asks Ruken's own parser (`parseManifest` from
// `@ruken/manifest`) rather than copying its rules (audit of PR #8: a hand-copied path rule accepted
// `audio/My Song.m4a`, which Ruken refuses).
//
// The check writes a minimal `ruken.toml` around the fields content produces (`[content]`, `[analytics]`)
// and every file `assets.toml` lists as `[loading] preload`, parses it, and places each refusal back at the
// key in `game.toml` or `assets.toml` that produced it. The other tables are fixed placeholders that Ruken
// accepts; ship writes the real ones.

import { type ManifestError, parseManifest } from '@ruken/manifest'
import type { DataPath, Problem } from '../../diagnostics/diagnostic'
import type { AssetsSource, RukenFields } from '../game-facts'

/** Accepted by Ruken, for checking assets when the game has no game.toml yet. */
const PLACEHOLDER_FIELDS: RukenFields = {
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
  analytics: { custom_events: [] },
}

// A JSON string is almost a TOML basic string: both have the escapes \" \\ \b \f \n \r \t \uXXXX, and JSON
// escapes U+0000 to U+001F. TOML also refuses a raw DEL (U+007F), which JSON leaves as it is, so DEL is
// escaped too (audit of PR #8). Any other text TOML refuses is still reported, by `placeError`.
const tomlString = (value: string): string => JSON.stringify(value).replaceAll('\u007f', '\\u007F')

const tomlList = (values: readonly string[]): string => `[${values.map(tomlString).join(', ')}]`

function manifestText(fields: RukenFields, preload: readonly string[]): string {
  const { content, analytics } = fields
  return [
    'schema = 1',
    '[game]',
    'id = "content-check"',
    'title = "Content check"',
    'version = "0.0.0"',
    'entry = "index.html"',
    'sdk = "^0.0.0"',
    '[runtime]',
    'renderer = "webgl2"',
    'orientation = "any"',
    'inputs = ["touch"]',
    'pause_behavior = "pause"',
    '[network]',
    'connect = []',
    '[content]',
    `languages = ${tomlList(content.languages)}`,
    `rating = ${tomlString(content.rating)}`,
    `descriptors = ${tomlList(content.descriptors)}`,
    ...(content.estimated_hours === undefined ? [] : [`estimated_hours = ${content.estimated_hours}`]),
    '[analytics]',
    `custom_events = ${tomlList(analytics.custom_events)}`,
    ...(preload.length === 0 ? [] : ['[loading]', `preload = ${tomlList(preload)}`]),
    '',
  ].join('\n')
}

/** `content.descriptors[2]` → `{ table: 'content.descriptors', index: 2 }`. */
function splitPath(path: string): { table: string; index: number | undefined } {
  const match = /^(.*)\[(\d+)\]$/.exec(path)
  return match === null
    ? { table: path, index: undefined }
    : { table: match[1] ?? '', index: Number(match[2]) }
}

/** Where a `[content]` or `[analytics]` value comes from in game.toml. */
const GAME_KEYS: Readonly<Record<string, string>> = {
  'content.languages': 'source_language',
  'content.rating': 'rating',
  'content.descriptors': 'descriptors',
  'content.estimated_hours': 'estimated_hours',
  'analytics.custom_events': 'custom_events',
}

export interface RukenCheck {
  /** Problems placed in game.toml. */
  readonly game: Problem[]
  /** Problems placed in assets.toml. */
  readonly assets: Problem[]
}

export function checkWithRuken(input: {
  readonly fields?: RukenFields | undefined
  readonly assets?: AssetsSource | undefined
}): RukenCheck {
  // Every asset file, in a fixed order (screens sorted, files as written), remembering where each came from.
  const entries: { file: string; path: DataPath }[] = []
  const screens = input.assets?.screens ?? {}
  for (const screen of Object.keys(screens).sort()) {
    screens[screen]?.files.forEach((file, index) => {
      entries.push({ file, path: ['screens', screen, 'files', index] })
    })
  }

  const parsed = parseManifest(
    manifestText(
      input.fields ?? PLACEHOLDER_FIELDS,
      entries.map((entry) => entry.file),
    ),
  )
  const result: RukenCheck = { game: [], assets: [] }
  if (parsed.ok) return result

  for (const error of parsed.errors) placeError(error, input.fields !== undefined, entries, result)
  return result
}

function placeError(
  error: ManifestError,
  hasGame: boolean,
  entries: readonly { file: string; path: DataPath }[],
  result: RukenCheck,
): void {
  const { table, index } = splitPath(error.path)
  if (table === 'loading.preload' && index !== undefined) {
    const entry = entries[index]
    if (entry === undefined) return
    // Ruken names the list slot (`loading.preload[3]`); the author knows the file.
    const message = error.message.replace(error.path, entry.file)
    result.assets.push({ path: entry.path, code: 'invalidGame', message: `Ruken ${error.code}: ${message}` })
    return
  }
  const key = GAME_KEYS[table]
  if (key === undefined || !hasGame) {
    // Ruken refused something this check cannot trace to a key: text TOML cannot hold even escaped, or a
    // placeholder table, which would mean the check is out of date with Ruken. It is still a problem for the
    // author to see, never a crash, so it goes at the top of the file content handed over.
    const where = error.path === '' ? '' : ` (${error.path})`
    const problem: Problem = {
      path: [],
      code: 'invalidGame',
      message: `Ruken ${error.code}: ${error.message}${where}`,
    }
    if (hasGame) result.game.push(problem)
    else result.assets.push(problem)
    return
  }
  const path: DataPath = index === undefined ? [key] : [key, index]
  result.game.push({ path, code: 'invalidGame', message: `Ruken ${error.code}: ${error.message}` })
}
