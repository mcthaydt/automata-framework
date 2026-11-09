import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './root.ts'

// The changelog the site shows: the changesets that wait for the next release. Each is one real change, written for the
// people who use the packages, so the page has no entry of its own to keep true. When a release ships, its notes are
// the packages' CHANGELOG.md files and this list starts again.

export interface ChangelogEntry {
  /** The changeset's file name without `.md`. */
  readonly id: string
  /** The first sentence of the change, as plain words. */
  readonly title: string
  /** The packages it changes, sorted. */
  readonly packages: readonly string[]
  /** The day the file was added to git (`2026-11-06`); left out when git cannot say (a shallow clone, no repository). */
  readonly date?: string
}

const MAX_TITLE = 120

/** The first sentence of a changeset's text, with its code and bold marks taken off, cut at a word when long. */
export function changelogTitle(text: string): string {
  const plain = text.replace(/\s+/g, ' ').replace(/[`*]/g, '').trim()
  const sentence = /^.*?[.!?](?=\s|$)/.exec(plain)?.[0] ?? plain
  if (sentence.length <= MAX_TITLE) return sentence
  return `${sentence.slice(0, MAX_TITLE).replace(/\s+\S*$/, '')}…`
}

function isShallow(root: string): boolean {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim() !== 'false'
    )
  } catch {
    return true
  }
}

function addedOn(root: string, file: string): string | undefined {
  try {
    const day = execFileSync('git', ['log', '--diff-filter=A', '--format=%as', '-1', '--', file], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined
  } catch {
    return undefined
  }
}

/** Every pending changeset, newest first (those with no date last, by name). */
export function readChangelog(root: string = repositoryRoot): ChangelogEntry[] {
  const folder = join(root, '.changeset')
  const dated = !isShallow(root)
  return readdirSync(folder)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name): ChangelogEntry => {
      const text = readFileSync(join(folder, name), 'utf8')
      const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text)
      const packages = [...(match?.[1] ?? '').matchAll(/^['"]?(@[^'":\s]+)['"]?\s*:/gm)].map(
        (found) => found[1] as string,
      )
      const date = dated ? addedOn(root, join('.changeset', name)) : undefined
      return {
        id: name.slice(0, -3),
        title: changelogTitle(match?.[2] ?? text),
        packages: packages.sort(),
        ...(date === undefined ? {} : { date }),
      }
    })
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.id.localeCompare(b.id))
}
