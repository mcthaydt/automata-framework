import { ID_REGEX } from '../../shared/create-game/create-game.ts'

// `automata add <kit> [--dir <game>] [--repo <url>] [--force]` (PRODUCT spec §9, PRODUCT.5 plan 5d).

/** The private Automata Plus repository; buyers are given read access on purchase (PRODUCT spec §6). */
export const PLUS_REPOSITORY = 'https://github.com/mcthaydt/automata-plus.git'

export interface AddOptions {
  /** The kit's folder in the Plus repository. */
  readonly kit: string
  /** The game folder, relative to the working folder. */
  readonly dir: string
  /** The repository to read kits from: a URL `git clone` accepts. */
  readonly repo: string
  /** Replace files the game already has instead of refusing. */
  readonly force: boolean
}

export type AddArgs =
  | { readonly ok: true; readonly options: AddOptions }
  | { readonly ok: false; readonly problem: string }

const VALUE_FLAGS = { '--dir': 'dir', '--repo': 'repo' } as const

const takesValue = (token: string): token is keyof typeof VALUE_FLAGS => Object.hasOwn(VALUE_FLAGS, token)

export function parseAddArgs(args: readonly string[]): AddArgs {
  const values = { dir: '.', repo: PLUS_REPOSITORY }
  let kit: string | undefined
  let force = false
  for (let i = 0; i < args.length; i++) {
    const token = args[i] as string
    if (token === '--force') force = true
    else if (takesValue(token)) {
      const value = args[i + 1]
      if (value === undefined || value.startsWith('-'))
        return { ok: false, problem: `${token} needs a value` }
      values[VALUE_FLAGS[token]] = value
      i++
    } else if (token.startsWith('-')) return { ok: false, problem: `unknown option ${token}` }
    else if (kit === undefined) kit = token
    else return { ok: false, problem: `unexpected argument ${token}` }
  }
  if (kit === undefined) return { ok: false, problem: 'a kit name is required' }
  // The name becomes a folder name inside the cloned repository, so it may not be a path.
  if (!ID_REGEX.test(kit))
    return {
      ok: false,
      problem: `"${kit}" is not a kit name (lowercase letters, digits and single hyphens, such as results-screen)`,
    }
  return { ok: true, options: { kit, dir: values.dir, repo: values.repo, force } }
}
