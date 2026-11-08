// The change set over the game's git checkout (editor suite spec §4.3, §4.5, EDS-D10), after The Last Light's
// `ChangeSets` (`92e6704`, `editor/src/server/changeset.ts`): one branch `edit/<slug>` per change set, one open at a
// time, a checkpoint commits only the recorded files, and Ship checkpoints, pushes and opens a draft PR with the
// person's own `gh`, or gives the compare link without it. The change set stays open after Ship.
//
// The journal (files recorded and created, each write's text, the latest run per check, tokens used and the cap) is
// JSON in the checkout's git directory, `<git dir>/automata-editor/<branch>.json`: outside the work tree, never
// committed, and shared by every device that edits through this checkout. The open change set is the journal of the branch that is checked out.
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ChangeSet, ChangeSetSummary } from '../../../shared/kit/ports/suite-ports.ts'
import { CHANGE_SET_JOURNAL_FORMAT, type ChangeSetJournal, changeSetJournalSchema } from '../core'
import { runArgv } from './run-argv'

export interface GitChangeSetOptions {
  /** The game's checkout. */
  readonly root: string
  /** The assistant's tokens one change set may use (default 200 000, The Last Light's). */
  readonly tokenCap?: number | undefined
  /** The repository's web address for the compare link; default: read from the `origin` remote. */
  readonly webUrl?: string | undefined
  /** The `gh` command (default `['gh']`); `false` for none, so Ship gives only the compare link. */
  readonly gh?: readonly string[] | false | undefined
}

export interface GitChangeSet extends ChangeSet {
  /** The workspace created `path` (a write expecting `'absent'`), so `remove` may take it back (EDS.1d-b). */
  noteCreated(path: string): Promise<void>
}

/** Git never asks for a password on the terminal: a missing credential fails the push with git's reason. */
const GIT_ENV = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
/** Pushing and talking to GitHub may wait on the network; a stuck one fails rather than hangs Ship. */
const NETWORK_TIMEOUT_MS = 120_000

/** `edit/` and the title in lower-case words joined by `-` (the memory fake's rule); rejects a title with none. */
function branchName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug === '') throw new Error(`"${title}" gives no branch name: use a letter or a digit`)
  return `edit/${slug}`
}

/** The web address of a remote: `git@github.com:o/r.git` and `https://user@github.com/o/r.git` give `https://github.com/o/r`. */
function webAddress(remote: string): string {
  const scp = /^[\w.-]+@([^:/]+):(.+?)(?:\.git)?\/?$/.exec(remote)
  if (scp !== null) return `https://${scp[1]}/${scp[2]}`
  const url = /^(?:https?|ssh|git):\/\/(?:[^@/]+@)?([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?\/?$/.exec(remote)
  if (url !== null) return `https://${url[1]}/${url[2]}`
  return remote
}

/** The paths `git status -z` names, the source of a rename or copy included. */
function statusPaths(porcelain: string): string[] {
  const fields = porcelain.split('\0').filter((field) => field !== '')
  const paths: string[] = []
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] ?? ''
    paths.push(field.slice(3))
    if (field[0] === 'R' || field[0] === 'C') {
      index += 1
      paths.push(fields[index] ?? '')
    }
  }
  return paths
}

const summaryOf = (journal: ChangeSetJournal): ChangeSetSummary => ({
  title: journal.title,
  branch: journal.branch,
  base: journal.base,
  files: journal.files,
  created: journal.created,
  tokens: journal.tokens,
  writes: journal.writes,
  checks: journal.checks,
})

export function createGitChangeSet(options: GitChangeSetOptions): GitChangeSet {
  const { root } = options
  const cap = options.tokenCap ?? 200_000
  const gh = options.gh ?? ['gh']

  const git = async (...args: string[]): Promise<string> => {
    const result = await runArgv(['git', ...args], { cwd: root, env: GIT_ENV, timeoutMs: NETWORK_TIMEOUT_MS })
    if (result.code !== 0)
      throw new Error(`git ${args[0]} failed: ${(result.stderr || result.error || result.stdout).trim()}`)
    return result.stdout
  }
  /** One line of git's answer (a branch, a commit). */
  const gitLine = async (...args: string[]): Promise<string> => (await git(...args)).trim()

  let journals: Promise<string> | undefined
  const journalsDir = (): Promise<string> => {
    journals ??= gitLine('rev-parse', '--absolute-git-dir').then((dir) => join(dir, 'automata-editor'))
    return journals
  }
  const journalPath = async (branch: string) => join(await journalsDir(), `${branch}.json`)

  const readJournal = async (path: string): Promise<ChangeSetJournal | undefined> => {
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
    return changeSetJournalSchema.parse(JSON.parse(text))
  }

  /** Written to a side file and renamed over, so a reader on another device never sees half a journal. */
  const writeJournal = async (journal: ChangeSetJournal): Promise<void> => {
    const path = await journalPath(journal.branch)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(`${path}.tmp`, `${JSON.stringify(journal, null, 2)}\n`)
    await rename(`${path}.tmp`, path)
  }

  const open = async (): Promise<ChangeSetJournal | undefined> => {
    const branch = await gitLine('branch', '--show-current')
    return branch === '' ? undefined : readJournal(await journalPath(branch))
  }

  const required = async (doing: string): Promise<ChangeSetJournal> => {
    const journal = await open()
    if (journal === undefined) throw new Error(`no change set is open to ${doing}`)
    return journal
  }

  /** The recorded files whose text differs from the last commit. */
  const changed = async (files: readonly string[]): Promise<string[]> =>
    files.length === 0
      ? []
      : statusPaths(await git('status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...files))

  const checkpoint = async (message: string): Promise<{ commit: string }> => {
    const journal = await required('checkpoint')
    const paths = await changed(journal.files)
    if (paths.length > 0) {
      await git('add', '-A', '--', ...paths)
      await git('commit', '-q', '-m', message, '--', ...paths)
    }
    return { commit: await gitLine('rev-parse', 'HEAD') }
  }

  /** The draft PR's address: the open one for the branch, or a new draft; undefined without a working `gh`. */
  const openPullRequest = async (
    journal: ChangeSetJournal,
    draft: { readonly title: string; readonly body: string },
  ): Promise<string | undefined> => {
    if (gh === false) return undefined
    const run = (...args: string[]) =>
      runArgv([...gh, ...args], { cwd: root, env: GIT_ENV, timeoutMs: NETWORK_TIMEOUT_MS })
    const address = (stdout: string) =>
      stdout
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('https://'))
    const existing = await run('pr', 'view', journal.branch, '--json', 'url', '--jq', '.url')
    if (existing.code === 0 && address(existing.stdout) !== undefined) return address(existing.stdout)
    const created = await run(
      'pr',
      'create',
      '--draft',
      '--head',
      journal.branch,
      '--base',
      journal.base,
      '--title',
      draft.title,
      '--body',
      draft.body,
    )
    return created.code === 0 ? address(created.stdout) : undefined
  }

  return {
    async current() {
      const journal = await open()
      return journal === undefined
        ? undefined
        : { title: journal.title, branch: journal.branch, base: journal.base }
    },
    async begin(title) {
      const already = await open()
      if (already !== undefined) throw new Error(`the change set "${already.title}" is still open`)
      const branch = branchName(title)
      const base = await gitLine('branch', '--show-current')
      if (base === '') throw new Error('the checkout is not on a branch: switch to the base branch first')
      await git('switch', '-q', '-c', branch)
      await writeJournal({
        format: CHANGE_SET_JOURNAL_FORMAT,
        title,
        branch,
        base,
        files: [],
        created: [],
        tokens: { used: 0, cap },
        writes: [],
        checks: [],
      })
    },
    async record(files, writes = []) {
      const journal = await required('record files in')
      const paths = [...journal.files, ...files, ...writes.map((write) => write.path)]
      await writeJournal({
        ...journal,
        files: [...new Set(paths)].sort(),
        writes: [...journal.writes, ...writes],
      })
    },
    async note(checks) {
      const journal = await required('note checks in')
      const latest = new Map(journal.checks.map((check) => [check.check, check]))
      for (const check of checks) latest.set(check.check, check)
      await writeJournal({
        ...journal,
        checks: [...latest.values()].sort((a, b) => (a.check < b.check ? -1 : 1)),
      })
    },
    async noteCreated(path) {
      const journal = await required('note a created file in')
      await writeJournal({ ...journal, created: [...new Set([...journal.created, path])].sort() })
    },
    checkpoint,
    async ship(draft) {
      const journal = await required('ship')
      await checkpoint(draft.title)
      await git('push', '-q', '-u', 'origin', journal.branch)
      const web = options.webUrl ?? webAddress(await gitLine('remote', 'get-url', 'origin'))
      const query = `expand=1&title=${encodeURIComponent(draft.title)}&body=${encodeURIComponent(draft.body)}`
      const pr = await openPullRequest(journal, draft)
      return {
        branch: journal.branch,
        pushed: true,
        ...(pr === undefined ? {} : { pr }),
        compareUrl: `${web}/compare/${journal.base}...${journal.branch}?${query}`,
      }
    },
    async spend(tokens) {
      const journal = await required('spend tokens in')
      if (!Number.isInteger(tokens) || tokens < 0)
        throw new RangeError(`tokens must be a whole number of zero or more, got ${tokens}`)
      await writeJournal({ ...journal, tokens: { ...journal.tokens, used: journal.tokens.used + tokens } })
    },
    async raiseCap(next) {
      const journal = await required('raise the cap of')
      if (!Number.isInteger(next) || next <= journal.tokens.cap)
        throw new RangeError(`the cap only goes up: ${next} is not above ${journal.tokens.cap}`)
      await writeJournal({ ...journal, tokens: { ...journal.tokens, cap: next } })
    },
    async close() {
      const journal = await open()
      if (journal === undefined) return
      const unsaved = await changed(journal.files)
      if (unsaved.length > 0)
        throw new Error(`${unsaved.join(', ')} changed since the last checkpoint: checkpoint them first`)
      await git('switch', '-q', journal.base)
      await rm(await journalPath(journal.branch), { force: true })
    },
    async list() {
      const dir = await journalsDir()
      let names: string[]
      try {
        names = await readdir(dir, { recursive: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
        throw error
      }
      const found: ChangeSetSummary[] = []
      for (const name of names.filter((entry) => entry.endsWith('.json')).sort()) {
        const journal = await readJournal(join(dir, name))
        if (journal !== undefined) found.push(summaryOf(journal))
      }
      return found
    },
  }
}
