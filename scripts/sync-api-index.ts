import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frameworkCommit } from './framework-source'

// The framework's API index (`pnpm api-index`, tooling/api-index) generates llms-full.txt from a defined corpus plus
// the complete API reference, and llms-api.txt from the package declarations (DX spec §2.3). The site publishes both
// byte for byte at framework.ref and records their commit, version and digests in src/data/api-index.json, which
// tests/api-index-published.test.ts holds the published files to. Run it after sync-demos has written framework.ref;
// the framework checkout needs `pnpm build` first, since the index reads the built declarations.

const __dirname = dirname(fileURLToPath(import.meta.url))
const frameworkDir = resolve(__dirname, '../../automata-framework')
const websiteDir = resolve(__dirname, '..')

export const PUBLISHED = ['llms-full.txt', 'llms-api.txt'] as const

export interface ApiIndexSource {
  commit: string
  version: string
  exports: number
  files: Record<(typeof PUBLISHED)[number], string>
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

/**
 * Copies the index's published files from `distDir` into the website's `static/` folder and writes the record.
 * Everything is read and checked before anything is written: a checkout at another commit than framework.ref, a
 * missing file, or a full text that does not end with the API reference it is published beside writes nothing.
 */
export function installApiIndex(distDir: string, website: string, commit: string, frameworkRef: string): ApiIndexSource {
  if (commit !== frameworkRef) throw new Error(`the framework checkout is at ${commit}, not framework.ref ${frameworkRef}; sync the demos first`)
  const read = (name: string): string => {
    const file = join(distDir, name)
    if (!existsSync(file)) throw new Error(`${name} is missing from ${distDir}; run pnpm build and pnpm api-index in the framework`)
    return readFileSync(file, 'utf8')
  }
  const index = JSON.parse(read('api.json')) as { version: string; exports: unknown[] }
  const text = { 'llms-full.txt': read('llms-full.txt'), 'llms-api.txt': read('llms-api.txt') }
  if (!text['llms-full.txt'].endsWith(text['llms-api.txt'])) throw new Error('llms-full.txt does not end with the API reference in llms-api.txt; regenerate both in one api-index run')
  for (const name of PUBLISHED) writeFileSync(join(website, 'static', name), text[name])
  const source: ApiIndexSource = {
    commit,
    version: index.version,
    exports: index.exports.length,
    files: { 'llms-full.txt': sha256(text['llms-full.txt']), 'llms-api.txt': sha256(text['llms-api.txt']) },
  }
  writeFileSync(join(website, 'src/data/api-index.json'), `${JSON.stringify(source, null, 2)}\n`)
  return source
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = frameworkCommit(frameworkDir)
  try {
    execFileSync(process.execPath, ['tooling/api-index/src/cli.ts'], { cwd: frameworkDir, stdio: 'inherit' })
  } catch (error) {
    // 1 is doc findings, with the files written; 2 is a tool error with nothing built.
    if ((error as { status?: number }).status !== 1) throw error
  }
  const frameworkRef = readFileSync(join(websiteDir, 'framework.ref'), 'utf8').trim()
  const source = installApiIndex(join(frameworkDir, 'tooling/api-index/dist'), websiteDir, commit, frameworkRef)
  console.log(`Published llms-full.txt and llms-api.txt (${source.exports} exports, version ${source.version}) from framework ${commit.slice(0, 7)}.`)
}
