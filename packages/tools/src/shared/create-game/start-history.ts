import { spawn } from 'node:child_process'

// A new game starts with its own git history, so the first thing an agent or a person changes can be undone. Git is run
// through a function, so tests say what it answers and no real repository is made.

/** Runs `git <args>` in `cwd`: how it ended, or `'missing'` when git is not installed. */
export type Git = (cwd: string, args: readonly string[]) => Promise<{ readonly code: number } | 'missing'>

/** How the history went: made with a first commit, no git on this computer, or made but not yet committed. */
export type HistoryOutcome = 'committed' | 'git-missing' | 'not-committed' | 'inside-a-repository'

/** The real git. */
export const liveGit: Git = (cwd, args) =>
  new Promise((resolve) => {
    const child = spawn('git', [...args], { cwd, stdio: 'ignore' })
    child.on('error', (error) =>
      resolve((error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : { code: 1 }),
    )
    child.on('close', (code) => resolve({ code: code ?? 1 }))
  })

/**
 * Makes `dir` a git repository and commits everything in it as "Start <title>". A folder already inside a repository is
 * left alone (a game made in a person's own monorepo must not get a second history). A commit that fails (git has no
 * name to put on it yet) leaves the repository made.
 */
export async function startHistory(git: Git, dir: string, title: string): Promise<HistoryOutcome> {
  const inside = await git(dir, ['rev-parse', '--is-inside-work-tree'])
  if (inside === 'missing') return 'git-missing'
  if (inside.code === 0) return 'inside-a-repository'
  for (const args of [['init'], ['add', '-A']] as const) {
    const done = await git(dir, args)
    if (done === 'missing') return 'git-missing'
    if (done.code !== 0) return 'not-committed'
  }
  const committed = await git(dir, ['commit', '-m', `Start ${title}`])
  return committed !== 'missing' && committed.code === 0 ? 'committed' : 'not-committed'
}
