import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { frameworkCommit } from './framework-source'

// The playground modules the framework owns and the site uses unchanged (spec §4, §5.1, §11.3): copied verbatim
// from the framework checkout beside the site, each under a first line naming the commit, never edited by hand.
// tests/playground-sync.test.ts fails when a copy differs from the framework file at framework.ref.

const __dirname = dirname(fileURLToPath(import.meta.url))
const frameworkDir = resolve(__dirname, '../../automata-framework')
const websiteDir = resolve(__dirname, '..')

export const PLAYGROUND_COPIES = [
  { from: 'tooling/examples-runner/src/playground/playground-protocol.ts', to: 'src/lib/playground/protocol.ts' },
  { from: 'tooling/examples-runner/src/playground/playground-headers.ts', to: 'src/lib/playground/headers.ts' },
] as const

/** The first line of a copy, naming where it came from. */
export function copyHeader(commit: string, from: string): string {
  return `// Copied from automata-framework ${commit}:${from} by scripts/sync-playground.ts. Do not edit; run pnpm sync.`
}

export function syncPlaygroundCopies(commit: string): void {
  for (const { from, to } of PLAYGROUND_COPIES) {
    const text = readFileSync(join(frameworkDir, from), 'utf8')
    writeFileSync(join(websiteDir, to), `${copyHeader(commit, from)}\n${text}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const commit = frameworkCommit(frameworkDir)
  syncPlaygroundCopies(commit)
  console.log(`Copied the playground protocol and headers from framework ${commit.slice(0, 7)}.`)
}
