// Usage: pnpm api-report [--update] [--since <ref>]
// Checks every core package's committed API report against source, and fails on an API break against the
// reports at <ref> (default: where HEAD left origin/main, base-ref.ts) that no changeset declares (PRODUCT spec §2 F6). --update rewrites
// the reports. Exit 0 clean, 1 findings, 2 tool error (the base ref is missing: fetch it).
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseRefFor } from './base-ref.ts'
import { REPORTS_DIR, runApiReport } from './run.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const args = process.argv.slice(2)
const update = args.includes('--update')
const sinceIndex = args.indexOf('--since')
const git = (...gitArgs: string[]) =>
  execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const since = baseRefFor(git, sinceIndex >= 0 ? (args[sinceIndex + 1] ?? '') : undefined)

function main(): number {
  let baseReport: ((file: string) => string | undefined) | undefined
  if (!update) {
    try {
      git('rev-parse', '--verify', '--quiet', `${since}^{commit}`)
    } catch {
      console.error(
        `api-report: ${since} is not a commit here; fetch it (git fetch origin main) or pass --since <ref>`,
      )
      return 2
    }
    baseReport = (file) => {
      try {
        return git('show', `${since}:${REPORTS_DIR}/${file}`)
      } catch {
        return undefined // not on the base branch: a new package
      }
    }
  }
  const changesetDir = join(root, '.changeset')
  const changesets: Record<string, string> = {}
  for (const name of readdirSync(changesetDir).sort()) {
    if (name.endsWith('.md') && name !== 'README.md')
      changesets[name] = readFileSync(join(changesetDir, name), 'utf8')
  }
  const result = runApiReport({
    root,
    reportsDir: join(root, REPORTS_DIR),
    update,
    changesets,
    ...(baseReport === undefined ? {} : { baseReport }),
  })
  for (const line of result.report) (result.exitCode === 0 ? console.log : console.error)(line)
  return result.exitCode
}

process.exitCode = main()
