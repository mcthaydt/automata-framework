import { describe, expect, it } from 'vitest'
import { listWaiting } from '#src/shared/kit/review/waiting-changes.ts'
import { FakePulls } from './fake-pulls.ts'

const row = (glob: string, editor: string) => ({ glob, editor })
const GAME = {
  repo: { owner: 'mcthaydt', name: 'lantern-run' },
  me: 'mcthaydt',
  rows: [row('content/feel.toml', 'feel'), row('content/levels/*.af2d.json', 'levels-2d')],
  labels: { feel: 'Feel', 'levels-2d': 'Levels' },
}

describe('the changes waiting for you', () => {
  it("lists a claude/ branch and another person's pull request, with the editors they touch", async () => {
    const api = new FakePulls()
      .add({
        number: 7,
        title: 'Faster flash',
        author: 'claude-bot',
        branch: 'claude/flash',
        files: ['content/feel.toml'],
        runs: [{ name: 'check', conclusion: 'success' }],
      })
      .add({
        number: 9,
        title: 'A new cave',
        author: 'friend',
        branch: 'cave',
        files: ['content/levels/cave.af2d.json'],
      })
    expect(await listWaiting(api, GAME)).toEqual([
      {
        id: 7,
        title: 'Faster flash',
        author: 'claude-bot',
        branch: 'claude/flash',
        editors: ['Feel'],
        checks: 'passed',
      },
      {
        id: 9,
        title: 'A new cave',
        author: 'friend',
        branch: 'cave',
        editors: ['Levels (Cave)'],
        checks: 'none',
      },
    ])
  })

  it('leaves out your own branches and pull requests that are closed', async () => {
    const api = new FakePulls()
      .add({ number: 1, title: 'Mine', author: 'mcthaydt', branch: 'tweak', files: [] })
      .add({
        number: 2,
        title: 'Done',
        author: 'claude-bot',
        branch: 'claude/done',
        files: [],
        state: 'closed',
      })
    expect(await listWaiting(api, GAME)).toEqual([])
  })

  it('lists your own claude/ branch, because Claude Code pushes as you', async () => {
    const api = new FakePulls().add({
      number: 3,
      title: 'By Claude',
      author: 'mcthaydt',
      branch: 'claude/x',
      files: ['content/feel.toml'],
    })
    expect((await listWaiting(api, GAME)).map((change) => change.id)).toEqual([3])
  })

  it('reads a failed check run, a failed status, a running check and a passing one', async () => {
    const api = new FakePulls()
      .add({
        number: 1,
        title: 'a',
        author: 'c',
        branch: 'claude/a',
        files: [],
        runs: [{ name: 'pnpm check', conclusion: 'failure' }],
      })
      .add({
        number: 2,
        title: 'b',
        author: 'c',
        branch: 'claude/b',
        files: [],
        statuses: [{ context: 'ci/feel', state: 'error' }],
      })
      .add({
        number: 3,
        title: 'c',
        author: 'c',
        branch: 'claude/c',
        files: [],
        runs: [{ name: 'pnpm check' }],
      })
      .add({
        number: 4,
        title: 'd',
        author: 'c',
        branch: 'claude/d',
        files: [],
        runs: [
          { name: 'a', conclusion: 'success' },
          { name: 'b', conclusion: 'skipped' },
        ],
        statuses: [{ context: 's', state: 'success' }],
      })
    const changes = await listWaiting(api, GAME)
    expect(changes.map((change) => [change.checks, change.failedCheck])).toEqual([
      ['failed', 'pnpm check'],
      ['failed', 'ci/feel'],
      ['running', undefined],
      ['passed', undefined],
    ])
  })

  it('says GitHub is unreachable in words, not as a crash', async () => {
    const api = { request: async () => ({ status: 401, json: { message: 'Bad credentials' } }) }
    await expect(listWaiting(api, GAME)).rejects.toThrow(
      'Automata could not read the changes waiting on GitHub. Sign in again.',
    )
  })
})
