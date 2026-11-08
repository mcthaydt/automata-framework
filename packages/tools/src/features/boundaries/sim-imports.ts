import { dirname, join, relative, resolve } from 'node:path'
import { GAME_SIM_SET_NAMES } from './files.ts'
import { simEntryVerdict } from './sim-entries.ts'
import { IMPORT_ALLOWED } from './sim-rules.ts'

// Which packages and files a sim file may import: the allowlist, the file's own root, a game's sim files, and the
// extensions' declared entries.

/** What decides whether an import is allowed, beyond the allowlist. */
export interface ImportScope {
  /** The source root being checked. When set, a relative import that resolves outside it is reported. */
  readonly root?: string
  /**
   * More import specifiers this root may use, by exact name: another sim folder's entry point that is checked
   * on its own (a demo's sim on its base's sim, `@af-games/emberwick/sim`).
   */
  readonly allowImports?: readonly string[]
  /**
   * A game laid out by role: the resolved paths of its sim files. A relative value import from a sim
   * file must resolve to one of them; type-only imports stay free.
   */
  readonly simSet?: ReadonlySet<string>
}

/** Whether `source` may be imported from `file`; `detail` explains a refusal the extension's own declaration caused. */
export function importVerdict(
  file: string,
  source: string,
  options: ImportScope,
): { ok: boolean; detail?: string } {
  if (source.startsWith('./') || source.startsWith('../')) {
    if (options.simSet !== undefined) {
      const target = resolve(dirname(file), source)
      // TypeScript resolves `./x.ts`, `./x`, a NodeNext `./x.js` and a folder's `./x/index.ts` to the same file.
      const candidates = [target, `${target}.ts`, target.replace(/\.js$/, '.ts'), join(target, 'index.ts')]
      return candidates.some((path) => options.simSet?.has(path))
        ? { ok: true }
        : { ok: false, detail: `the sim imports ${source}, which is outside the sim (${GAME_SIM_SET_NAMES})` }
    }
    if (options.root === undefined) return { ok: true }
    const target = relative(resolve(options.root), resolve(dirname(file), source))
    return { ok: !target.startsWith('..') }
  }
  if (IMPORT_ALLOWED.has(source) || (options.allowImports?.includes(source) ?? false)) return { ok: true }
  // An installed extension may declare sim entries of its own.
  const verdict = simEntryVerdict(file, source)
  if (verdict.allowed) return { ok: true }
  return verdict.detail === undefined ? { ok: false } : { ok: false, detail: verdict.detail }
}
