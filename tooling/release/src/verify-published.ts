// Usage: node tooling/release/src/verify-published.ts --version <0.0.n>
// Run by release-packages.yml right after `changeset publish`. `changeset publish` exits 0 both
// when it published and when it skipped everything, so its exit code proves nothing; this looks every
// publishable package up on GitHub Packages at the released version and fails, naming each one still missing.
// Re-running the release job then publishes exactly the missing ones (changesets skips versions already there).
//
// GitHub Packages can lag a few seconds behind a publish, so a missing package is retried up to 5 times with
// backoff, about a minute in all. A lookup that errors (401, network) is never taken as "present".
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { publishablePackages } from './publishable-packages.ts'

/** The version the registry has for `name@version`, or undefined if it has none. Throws on a failed lookup. */
export type Lookup = (name: string, version: string) => Promise<string | undefined>

export interface VerifyOptions {
  readonly lookup: Lookup
  readonly sleep: (ms: number) => Promise<void>
}

export interface VerifyResult {
  readonly ok: boolean
  /** `name@version`, with the lookup's error in parentheses when it failed rather than came back empty. */
  readonly missing: readonly string[]
}

/** Waits between the 5 tries: 60 s in all. */
const BACKOFF_MS: readonly number[] = [5_000, 10_000, 20_000, 25_000]

export async function verifyPublished(
  names: readonly string[],
  version: string,
  options: VerifyOptions,
): Promise<VerifyResult> {
  let pending = [...names]
  const errors = new Map<string, string>()
  for (let attempt = 0; ; attempt++) {
    const stillMissing: string[] = []
    for (const name of pending) {
      try {
        const found = await options.lookup(name, version)
        if (found === version) errors.delete(name)
        else stillMissing.push(name)
      } catch (error) {
        errors.set(name, error instanceof Error ? error.message : String(error))
        stillMissing.push(name)
      }
    }
    pending = stillMissing
    const wait = BACKOFF_MS[attempt]
    if (pending.length === 0 || wait === undefined) break
    await options.sleep(wait)
  }
  const missing = pending.map((name) => {
    const error = errors.get(name)
    return error === undefined ? `${name}@${version}` : `${name}@${version} (${error.trim()})`
  })
  return { ok: missing.length === 0, missing }
}

/**
 * The one version a release published, from changesets/action's `published-packages` output
 * (`[{ "name": …, "version": … }]`). Every package shares it (the fixed group), so disagreement is an error.
 */
export function releasedVersion(publishedPackages: string): string {
  const packages = JSON.parse(publishedPackages) as { name: string; version: string }[]
  const versions = [...new Set(packages.map((pkg) => pkg.version))].sort()
  if (versions.length === 0) throw new Error('the release published nothing')
  if (versions.length > 1) throw new Error(`the release published several versions: ${versions.join(', ')}`)
  return versions[0] as string
}

const run = promisify(execFile)

/** `pnpm view <name>@<version> version`, authenticated by the `.npmrc` setup-node writes. A 404 is "none". */
export const pnpmView: Lookup = async (name, version) => {
  try {
    const { stdout } = await run('pnpm', ['view', `${name}@${version}`, 'version'])
    return stdout.trim() === '' ? undefined : stdout.trim()
  } catch (error) {
    const output = String((error as { stderr?: string }).stderr ?? error)
    if (/E404|404 Not Found/.test(output)) return undefined
    throw new Error(output.split('\n').find((line) => line.trim() !== '') ?? 'pnpm view failed')
  }
}

async function main(): Promise<void> {
  const index = process.argv.indexOf('--version')
  const version = index === -1 ? undefined : process.argv[index + 1]
  if (version === undefined || !/^\d+\.\d+\.\d+/.test(version)) {
    console.error('usage: verify-published --version <x.y.z>')
    process.exitCode = 2
    return
  }
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const names = publishablePackages(root).map((pkg) => pkg.manifest.name)
  const result = await verifyPublished(names, version, {
    lookup: pnpmView,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  })
  for (const missing of result.missing) console.error(`not on the registry: ${missing}`)
  console.log(`verify-published: ${names.length - result.missing.length}/${names.length} at ${version}`)
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
