#!/usr/bin/env node
// `pnpm core:sync [--repository <url or path>]`: builds core from the framework at the commit in core.ref and points
// pnpm-workspace.yaml at the packs (see sync-core.ts). Exit 0 synced, 1 the sync failed, 2 a bad argument.
import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AF_REPOSITORY, liveGit, liveShell, syncCore } from './sync-core.ts'

export const USAGE = 'usage: pnpm core:sync [--repository <url or path of the framework>]'

export interface Args {
  readonly repository: string
}

/** A URL or an scp-style `user@host:path` goes to git as it is; anything else is a local path. */
const isRemote = (value: string): boolean =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[^/]+@[^/]+:/.test(value)

export function parseArgs(argv: readonly string[], cwd: string): Args {
  let repository = AF_REPOSITORY
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string
    if (arg !== '--repository') throw new Error(`unknown argument ${arg}\n${USAGE}`)
    const value = argv[++i]
    if (value === undefined) throw new Error(`--repository needs a value\n${USAGE}`)
    // The value is git fetch's repository argument, and git reads one that starts with "-" as an option of its own.
    if (value.startsWith('-')) throw new Error(`--repository must not start with "-": ${value}\n${USAGE}`)
    // git runs inside .core/af, so a relative path is made absolute from where the command ran.
    repository = isRemote(value) || isAbsolute(value) ? value : resolve(cwd, value)
  }
  return { repository }
}

function main(): void {
  let args: Args
  try {
    args = parseArgs(process.argv.slice(2), process.env.INIT_CWD ?? process.cwd())
  } catch (error) {
    console.error(`core:sync: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(2)
  }
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const started = performance.now()
  try {
    const result = syncCore({
      root,
      repository: args.repository,
      git: liveGit,
      shell: liveShell,
      log: console.log,
    })
    const seconds = ((performance.now() - started) / 1000).toFixed(1)
    console.log(`core:sync: done in ${seconds} s (${result.built ? 'built' : 'already current'})`)
  } catch (error) {
    console.error(`core:sync: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

if (import.meta.main) main()
