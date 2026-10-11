// Usage: node tooling/release/src/sync-versions.ts   (run by `pnpm release:version` after `changeset version`)
// `changeset version` bumps every package.json; the sim also states its version in source, as `SIM_VERSION` in
// `packages/sim/src/version.ts` (M2.3), which replay headers carry. This rewrites that constant to the new
// version so the sim's version test stays true (M2.4 spec §3.2). Until M2.3 adds the file there is nothing to do.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `export const SIM_VERSION…= '<version>'`, keeping any type annotation and the quote style. */
const SIM_VERSION = /(export const SIM_VERSION\b[^=]*=\s*)(['"])[^'"]*\2/

export type SyncResult = 'updated' | 'unchanged' | 'no-version-file'

export function syncSimVersion(root: string): SyncResult {
  const file = join(root, 'packages/sim/src/version.ts')
  if (!existsSync(file)) return 'no-version-file'
  const { version } = JSON.parse(readFileSync(join(root, 'packages/sim/package.json'), 'utf8')) as {
    version: string
  }
  const source = readFileSync(file, 'utf8')
  if (!SIM_VERSION.test(source)) throw new Error(`${file} has no SIM_VERSION constant to rewrite`)
  const next = source.replace(
    SIM_VERSION,
    (_match, head: string, quote: string) => `${head}${quote}${version}${quote}`,
  )
  if (next === source) return 'unchanged'
  writeFileSync(file, next)
  return 'updated'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = syncSimVersion(fileURLToPath(new URL('../../..', import.meta.url)))
  console.log(`sync-versions: SIM_VERSION ${result}`)
}
