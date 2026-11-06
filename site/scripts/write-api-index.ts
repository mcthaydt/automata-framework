import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { repositoryRoot } from '../src/shared/framework/root.ts'

// `node scripts/write-api-index.ts`: the API index (`pnpm api-index`) into tooling/api-index/dist, which the API pages,
// their search and the agents' text files read. It reads the packages' built declarations, so they are built first
// (turbo's `^build` for the site's build and unit tests).

export function writeApiIndex(): void {
  try {
    execFileSync(process.execPath, ['tooling/api-index/src/cli.ts'], {
      cwd: repositoryRoot,
      stdio: ['ignore', 'ignore', 'inherit'],
    })
  } catch (error) {
    // 1 is doc findings, reported with the files written; 2 is a tool error with nothing written.
    if ((error as { status?: number }).status !== 1) throw error
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) writeApiIndex()
