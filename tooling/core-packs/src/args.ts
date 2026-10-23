export interface Args {
  readonly out: string
  readonly extras: readonly string[]
  readonly allowDirty: boolean
  /** Given by a caller that built the packs from a checkout it did not make itself. */
  readonly sourceCommit?: string
}

const USAGE =
  'usage: core-packs --out <dir> [--extra <package name>]... [--source-commit <sha>] [--allow-dirty]'

export function parseArgs(argv: readonly string[]): Args {
  let out: string | undefined
  let sourceCommit: string | undefined
  let allowDirty = false
  const extras: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg === '--allow-dirty') {
      allowDirty = true
    } else if (arg === '--out' || arg === '--extra' || arg === '--source-commit') {
      const value = argv[++i]
      if (value === undefined) throw new Error(`${arg} needs a value\n${USAGE}`)
      if (arg === '--out') out = value
      else if (arg === '--extra') extras.push(value)
      else sourceCommit = value
    } else {
      throw new Error(`unknown argument ${arg}\n${USAGE}`)
    }
  }
  if (out === undefined) throw new Error(`--out is required\n${USAGE}`)
  return sourceCommit === undefined ? { out, extras, allowDirty } : { out, extras, allowDirty, sourceCommit }
}

/** Runs git in the workspace and returns what it printed. */
export type Git = (args: readonly string[]) => string

/**
 * The commit recorded in `packs.json`. A dirty tree is refused unless allowed, and then marked, so a pack never
 * claims a commit it was not built from (AGENTS.md: facts come from evidence).
 */
export function resolveSourceCommit(args: Args, git: Git): string {
  if (args.sourceCommit !== undefined) return args.sourceCommit
  const commit = git(['rev-parse', 'HEAD']).trim()
  const dirty = git(['status', '--porcelain', '--untracked-files=no']).trim() !== ''
  if (!dirty) return commit
  if (!args.allowDirty)
    throw new Error('the workspace has uncommitted changes; commit them or pass --allow-dirty')
  return `${commit}+dirty`
}
