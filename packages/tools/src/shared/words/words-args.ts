// The words after `automata words`, read into the options `runWords` takes. It only reads: the files and the model are
// the run's.

/** What one run of `automata words` was asked to do. */
export interface WordsOptions {
  /** The game's folder. */
  readonly dir: string
  /** One line to translate, instead of every missing or stale word. */
  readonly key?: string
  /** One language to translate into, instead of every language the game ships. */
  readonly to?: string
  /** Translate words that already have a translation too. */
  readonly all: boolean
  /** Record the source of each existing translation and call no model. */
  readonly mark: boolean
  /** A folder of words that is not a game's, such as a package's own (`<folder>/<lang>.json`). */
  readonly catalog?: string
  /** The language the words are written in. */
  readonly source: string
}

export type ParsedWords =
  | { readonly ok: true; readonly options: WordsOptions }
  | { readonly ok: false; readonly problem: string }

const WITH_VALUE = new Set(['--dir', '--to', '--catalog', '--source'])

/** Reads `[key] [--dir <folder>] [--to <lang>] [--all] [--mark] [--catalog <folder>] [--source <lang>]`. */
export function parseWordsArgs(args: readonly string[]): ParsedWords {
  let key: string | undefined
  let dir = '.'
  let to: string | undefined
  let catalog: string | undefined
  let source = 'en'
  let all = false
  let mark = false
  for (let index = 0; index < args.length; index++) {
    const token = args[index] as string
    if (WITH_VALUE.has(token)) {
      const value = args[index + 1]
      if (value === undefined || value.startsWith('--'))
        return { ok: false, problem: `${token} needs a value` }
      index += 1
      if (token === '--dir') dir = value
      else if (token === '--to') to = value
      else if (token === '--catalog') catalog = value
      else source = value
    } else if (token === '--all') all = true
    else if (token === '--mark') mark = true
    else if (token.startsWith('-')) return { ok: false, problem: `unknown option ${token}` }
    else if (key === undefined) key = token
    else return { ok: false, problem: `one key at a time: got "${key}" and "${token}"` }
  }
  if (all && key !== undefined)
    return { ok: false, problem: '--all and a key do not go together: a key is already one word' }
  if (to === source) return { ok: false, problem: `--to ${to} is the language the words are written in` }
  return {
    ok: true,
    options: {
      dir,
      all,
      mark,
      source,
      ...(key === undefined ? {} : { key }),
      ...(to === undefined ? {} : { to }),
      ...(catalog === undefined ? {} : { catalog }),
    },
  }
}
