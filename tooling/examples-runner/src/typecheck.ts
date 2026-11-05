// Typechecking the examples (EX spec §7): a pending example names verbs that have not landed, so it is left out of
// `tsc` until its task is ticked. The examples package's own tsconfig.json covers its config and e2e files; this
// adds every non-pending example by name.
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CatalogEntry } from './catalog.ts'

export interface TypecheckConfig {
  readonly extends: string
  readonly include: readonly string[]
  readonly files: readonly string[]
}

export function typecheckConfig(root: string, entries: readonly CatalogEntry[]): TypecheckConfig {
  return {
    extends: join(root, 'tsconfig.json'),
    include: [join(root, 'vite.config.ts'), join(root, 'playwright.config.ts'), join(root, 'e2e/*.ts')],
    files: entries.filter((entry) => entry.header?.pending === undefined).map((entry) => entry.file),
  }
}

/** Writes the generated tsconfig under node_modules/.cache and runs `tsc` on it; returns tsc's exit code. */
export function runTypecheck(root: string, entries: readonly CatalogEntry[]): number {
  const dir = join(root, 'node_modules/.cache/examples-runner')
  mkdirSync(dir, { recursive: true })
  const project = join(dir, 'tsconfig.json')
  writeFileSync(project, `${JSON.stringify(typecheckConfig(root, entries), null, 2)}\n`)
  const pending = entries.filter((entry) => entry.header?.pending !== undefined)
  for (const entry of pending)
    console.log(`typecheck: ${entry.path} is pending (${entry.header?.pending}), skipped`)
  return (
    spawnSync('tsc', ['-p', project], { stdio: 'inherit', shell: process.platform === 'win32' }).status ?? 1
  )
}
