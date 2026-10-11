// Runs on the dev host (plain `node builds-index.ts`), called by `deploy`.
// Usage: node builds-index.ts <root> <base-url> [limit]   → JSON on stdout.
//
// Lists the builds installed under <root>/builds, newest first, each with its link, so a page (or a person)
// can find every build of the game: one URL per build (FloorFifty `deploy/bin/builds-index.mjs`, D-4).

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface IndexedBuild {
  readonly buildId: string
  readonly url: string
  readonly commit: string
  readonly tag: string | null
  readonly branch: string | null
  readonly live: boolean
}

const BUILD_ID = /^[0-9]{12}-[0-9a-f]{7,40}$/

function readOrUndefined(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8').trim()
  } catch {
    return undefined
  }
}

export function buildsIndex(root: string, baseUrl: string, limit: number): IndexedBuild[] {
  const live = readOrUndefined(join(root, 'live'))
  // Build IDs start with the commit time, so a reverse sort of the names is newest first.
  const all = readdirSync(join(root, 'builds'))
    .filter((name) => BUILD_ID.test(name))
    .sort()
    .reverse()
  const ids = all.slice(0, limit)
  // The live build is always listed, last if it is older than the newest `limit`.
  if (live !== undefined && all.includes(live) && !ids.includes(live)) ids.push(live)
  return ids.map((buildId) => {
    const build = JSON.parse(readFileSync(join(root, 'builds', buildId, 'build.json'), 'utf8')) as {
      commit: string
      tag?: string | null
      branch?: string | null
    }
    return {
      buildId,
      url: `${baseUrl.replace(/\/+$/, '')}/builds/${buildId}/`,
      commit: build.commit,
      tag: build.tag ?? null,
      branch: build.branch ?? null,
      live: buildId === live,
    }
  })
}

if (import.meta.main) {
  const [root, baseUrl, limit] = process.argv.slice(2)
  if (root === undefined || baseUrl === undefined) {
    process.stderr.write('usage: builds-index.ts <root> <base-url> [limit]\n')
    process.exit(2)
  }
  process.stdout.write(`${JSON.stringify(buildsIndex(root, baseUrl, Number(limit ?? 10)), null, 2)}\n`)
}
