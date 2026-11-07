// `automata build [dir] [--debug]`. `--debug` builds with the debug constant on (`__AUTOMATA_DEBUG__`), so a game's dev-only
// tools (Plus's debug overlay) are present in the bundle; a release build, the default, drops them. It takes no `--target` yet.

export interface BuildOptions {
  /** The game folder; the working folder when undefined. */
  readonly dir: string | undefined
  /** Build with the debug constant on. */
  readonly debug: boolean
}

export type BuildArgs =
  | { readonly ok: true; readonly options: BuildOptions }
  | { readonly ok: false; readonly problem: string }

export function parseBuildArgs(args: readonly string[]): BuildArgs {
  let dir: string | undefined
  let debug = false
  for (const token of args) {
    if (token === '--debug') debug = true
    else if (token.startsWith('-')) return { ok: false, problem: `unknown option ${token}` }
    else if (dir === undefined) dir = token
    else return { ok: false, problem: `unexpected argument ${token}` }
  }
  return { ok: true, options: { dir, debug } }
}
