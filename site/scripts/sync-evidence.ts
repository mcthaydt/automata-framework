// Copies the framework's latest evidence file into src/data (DX.9w). The framework's parity job writes
// `evidence.json` and `evidence.schema.json` on every push to main and uploads them as the workflow artifact `evidence`
// (DX spec §3.10). This reads that artifact of the latest successful main run with the GitHub CLI, so it needs
// `gh auth login` with access to the (private) framework repository:
//   pnpm sync:evidence                     latest successful run on main
//   pnpm sync:evidence --from <folder>     a folder that holds the two files, for example an artifact downloaded by hand
// Either way the pair is validated (src/lib/evidence.ts) before anything is written, and the files are copied as they
// are, so the committed copy is byte for byte what CI produced.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEvidence, type Evidence } from '../src/lib/evidence'

const FRAMEWORK = 'mcthaydt/automata-framework'
const FILES = ['evidence.json', 'evidence.schema.json'] as const

export interface RunSummary {
  databaseId: number
  headSha: string
  conclusion: string
  createdAt: string
  url: string
}

/** The runs worth trying, newest first: a run that failed or was cancelled uploaded no evidence worth publishing. */
export function candidateRuns(runs: RunSummary[]): RunSummary[] {
  return runs.filter(run => run.conclusion === 'success').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** The artifact must describe the commit its run built, or it was not made by that run. */
export function assertFromRun(evidence: Evidence, run: RunSummary): void {
  if (evidence.revision.sha !== run.headSha) {
    throw new Error(`the evidence says revision ${evidence.revision.sha}, but run ${run.databaseId} built ${run.headSha}`)
  }
}

/** Validates the pair in `from` and, only if it is valid, copies both files into `to`. Returns what it validated. */
export function installEvidence(from: string, to: string): Evidence {
  for (const name of FILES) if (!existsSync(join(from, name))) throw new Error(`${join(from, name)} is missing; it needs ${FILES.join(' and ')}`)
  const evidence = parseEvidence(JSON.parse(readFileSync(join(from, 'evidence.json'), 'utf8')), JSON.parse(readFileSync(join(from, 'evidence.schema.json'), 'utf8')))
  for (const name of FILES) copyFileSync(join(from, name), join(to, name))
  return evidence
}

function gh(...args: string[]): string {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** Downloads the `evidence` artifact of the newest successful main run that has one. */
function downloadLatest(): { dir: string; run: RunSummary } {
  const runs = candidateRuns(JSON.parse(gh('run', 'list', '--repo', FRAMEWORK, '--workflow', 'ci.yml', '--branch', 'main', '--event', 'push', '--limit', '30', '--json', 'databaseId,headSha,conclusion,createdAt,url')) as RunSummary[])
  for (const run of runs) {
    const dir = mkdtempSync(join(tmpdir(), 'evidence-'))
    try {
      gh('run', 'download', String(run.databaseId), '--repo', FRAMEWORK, '--name', 'evidence', '--dir', dir)
      return { dir, run }
    } catch {
      // No evidence artifact on this run (the parity job was skipped, or the artifact expired): try the next one.
      rmSync(dir, { recursive: true, force: true })
    }
  }
  throw new Error(`none of the last ${runs.length} successful main runs of ${FRAMEWORK} has an evidence artifact`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const data = resolve(import.meta.dirname, '../src/data')
  const from = process.argv.indexOf('--from')
  if (from >= 0) {
    const dir = resolve(process.argv[from + 1] ?? '')
    const evidence = installEvidence(dir, data)
    console.log(`Wrote src/data/evidence.json from ${dir}: revision ${evidence.revision.sha.slice(0, 7)}, ${evidence.goldens.length} goldens.`)
  } else {
    const { dir, run } = downloadLatest()
    try {
      const evidence = parseEvidence(JSON.parse(readFileSync(join(dir, 'evidence.json'), 'utf8')), JSON.parse(readFileSync(join(dir, 'evidence.schema.json'), 'utf8')))
      assertFromRun(evidence, run)
      installEvidence(dir, data)
      console.log(`Wrote src/data/evidence.json from ${run.url}: revision ${evidence.revision.sha.slice(0, 7)}, ${evidence.goldens.length} goldens.`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
}
