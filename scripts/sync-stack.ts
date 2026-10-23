// Copies the framework's generated stack page into src/data (PRODUCT.4w). The framework writes `docs/stack.md` with
// `pnpm docs:stack` and fails its own `pnpm check` when it is stale (PRODUCT spec §8); the site renders that file on
// /inside without changing it. The copy is recorded with the framework commit that last changed the file and its sha256,
// so tests/stack-page.test.ts can hold the copy to the framework's file at that commit.
//   pnpm sync:stack                copy docs/stack.md from the sibling framework checkout's origin/main
//   pnpm sync:stack --ref <ref>    from another ref of that checkout
//   pnpm sync:stack --check        exit 1 when the copy is older than the framework's page; writes nothing
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const STACK_PATH = 'docs/stack.md'
export const REPOSITORY = 'mcthaydt/automata-framework'

export interface StackSource {
  repository: string
  path: string
  commit: string
  sha256: string
}

export function describeStack(text: string, commit: string): StackSource {
  return { repository: REPOSITORY, path: STACK_PATH, commit, sha256: createHash('sha256').update(text).digest('hex') }
}

function git(framework: string, ...args: string[]): string {
  return execFileSync('git', ['-C', framework, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

/** The page as the framework has it at `ref`, with the commit that last changed it. */
export function readFrameworkStack(framework: string, ref: string): { text: string; source: StackSource } {
  const commit = git(framework, 'log', '-1', '--format=%H', ref, '--', STACK_PATH).trim()
  if (!commit) throw new Error(`${ref} of ${framework} has no ${STACK_PATH}`)
  const text = git(framework, 'show', `${commit}:${STACK_PATH}`)
  return { text, source: describeStack(text, commit) }
}

export function isCurrent(recorded: StackSource, latest: StackSource): boolean {
  return recorded.commit === latest.commit && recorded.sha256 === latest.sha256
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(import.meta.dirname, '..')
  const refFlag = process.argv.indexOf('--ref')
  const ref = refFlag >= 0 ? process.argv[refFlag + 1]! : 'origin/main'
  const { text, source: next } = readFrameworkStack(resolve(root, '../automata-framework'), ref)
  if (process.argv.includes('--check')) {
    const current = JSON.parse(readFileSync(resolve(root, 'src/data/stack.source.json'), 'utf8')) as StackSource
    if (!isCurrent(current, next)) {
      console.error(`The site's stack page is from ${current.commit.slice(0, 7)}; ${ref} has ${next.commit.slice(0, 7)}. Run pnpm sync:stack.`)
      process.exit(1)
    }
    console.log(`The site's stack page is current with ${ref} (${next.commit.slice(0, 7)}).`)
  } else {
    writeFileSync(resolve(root, 'src/data/stack.md'), text)
    writeFileSync(resolve(root, 'src/data/stack.source.json'), `${JSON.stringify(next, null, 2)}\n`)
    console.log(`Wrote src/data/stack.md from ${ref} at ${next.commit.slice(0, 7)}.`)
  }
}
