// Usage: node tooling/release/src/check-changesets.ts
// Before 1.0 every AF release is a `0.0.x` patch, so a changeset that asks for `minor` or
// `major`, or names a package AF does not publish, fails CI's checks job, naming the file. AF 1.0 is
// what would change this rule. The one exception is the first public release: `first-public-release.md` may ask for
// `minor`, which takes the shared version from 0.0.x to 0.1.0 once; Changesets deletes the file when it versions.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { publishablePackages } from './publishable-packages.ts'

/** `---` front matter, then `'<package>': <bump>` lines (Changesets' format). */
const FRONT_MATTER = /^---\r?\n([\s\S]*?)^---\s*$/m
const RELEASE_LINE = /^\s*(['"]?)(@?[\w./-]+)\1\s*:\s*(\w+)\s*$/

/** The one changeset allowed a `minor` bump: the first public release (0.0.x to 0.1.0). */
const FIRST_RELEASE = 'first-public-release.md'

/** One release line of a changeset's front matter. */
export interface ChangesetRelease {
  readonly name: string
  readonly bump: string
}

/**
 * A changeset's release lines and the text after its front matter; undefined without front matter. Lines it
 * cannot read are skipped here (`changesetProblems` reports them). tooling/api-report reads breaks from it.
 */
export function readChangeset(
  text: string,
): { readonly releases: ChangesetRelease[]; readonly body: string } | undefined {
  const match = FRONT_MATTER.exec(text)
  if (match?.[1] === undefined) return undefined
  const releases: ChangesetRelease[] = []
  for (const line of match[1].split(/\r?\n/)) {
    const release = RELEASE_LINE.exec(line)
    if (release !== null) releases.push({ name: release[2] ?? '', bump: release[3] ?? '' })
  }
  return { releases, body: text.slice(match.index + match[0].length) }
}

/** Problems in the given changeset files (name to contents), one line each; empty means all is well. */
export function changesetProblems(
  files: Readonly<Record<string, string>>,
  publishedNames: readonly string[],
): string[] {
  const problems: string[] = []
  for (const [name, text] of Object.entries(files)) {
    const frontMatter = FRONT_MATTER.exec(text)?.[1]
    if (frontMatter === undefined) {
      problems.push(`${name}: no front matter (expected --- … --- with one package per line)`)
      continue
    }
    for (const line of frontMatter.split(/\r?\n/).filter((entry) => entry.trim() !== '')) {
      const release = RELEASE_LINE.exec(line)
      if (release === null) {
        problems.push(`${name}: cannot read "${line.trim()}"`)
        continue
      }
      const [, , packageName = '', bump = ''] = release
      if (!publishedNames.includes(packageName)) {
        problems.push(`${name}: ${packageName} is not a published package`)
      } else if (bump !== 'patch' && !(bump === 'minor' && name === FIRST_RELEASE)) {
        problems.push(`${name}: ${packageName} is a ${bump} bump; before 1.0 every AF changeset is a patch`)
      }
    }
  }
  return problems
}

function main(): void {
  const root = fileURLToPath(new URL('../../..', import.meta.url))
  const dir = join(root, '.changeset')
  const files: Record<string, string> = {}
  for (const name of readdirSync(dir).sort()) {
    if (name.endsWith('.md') && name !== 'README.md') files[name] = readFileSync(join(dir, name), 'utf8')
  }
  const problems = changesetProblems(
    files,
    publishablePackages(root).map((pkg) => pkg.manifest.name),
  )
  for (const problem of problems) console.error(`.changeset/${problem}`)
  console.log(`check-changesets: ${Object.keys(files).length} changesets, ${problems.length} problems`)
  process.exitCode = problems.length > 0 ? 1 : 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
