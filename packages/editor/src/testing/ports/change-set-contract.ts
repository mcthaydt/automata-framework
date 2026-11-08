import { describe, expect, test } from 'vitest'
import type { ChangeSet } from '../../shared/kit/ports/suite-ports'

/**
 * A fresh project with nothing open, and a way to change one of its files as the workspace would (the git adapter
 * writes the file in the checkout; the memory fake has no files and does nothing). The git adapter's project is a
 * clean checkout on a base branch, with a remote Ship can push to (a local bare one).
 */
export interface ChangeSetProject {
  readonly changeSet: ChangeSet
  edit(path: string, text: string): Promise<void>
}

/**
 * What every `ChangeSet` promises, run
 * against the in-memory fake and the git adapter. The cases only change files through `edit` and then
 * `record` them, as the suite does, so they hold for an adapter that reads the checkout. What an adapter must do:
 *
 * - `close()` with a recorded file that has changes no checkpoint holds rejects and keeps the branch (the adventure source
 *   refuses to close over uncommitted changes); after a checkpoint it goes back to the base and the change set leaves
 *   `list()` (its journal under `.git/automata-editor/` is removed or marked closed). With nothing open it does nothing.
 * - `checkpoint` commits only the recorded files; one with nothing new returns the last commit (HEAD).
 * - `spend` and `raiseCap` write the journal, so `list()` shows them on every device of that checkout.
 */
export function describeChangeSet(
  name: string,
  make: () => Promise<ChangeSetProject> | ChangeSetProject,
): void {
  describe(`ChangeSet contract: ${name}`, () => {
    const TUNING = 'content/tuning.toml'

    /** Opens a change set with one recorded edit of the tuning file. */
    async function withEdit(title = 'Faster'): Promise<ChangeSetProject> {
      const project = await make()
      await project.changeSet.begin(title)
      await project.edit(TUNING, 'MAX_MOVE_SPEED = 7.5\n')
      await project.changeSet.record([TUNING])
      return project
    }

    test('nothing is open at first, and the Review desk lists nothing', async () => {
      const { changeSet } = await make()
      expect(await changeSet.current()).toBeUndefined()
      expect(await changeSet.list()).toEqual([])
    })

    test('begin opens one: its title, a branch named from it, and the base it started from', async () => {
      const { changeSet } = await make()
      await changeSet.begin('Bay: arrival timing')
      const current = await changeSet.current()
      expect(current?.title).toBe('Bay: arrival timing')
      expect(current?.branch).toMatch(/arrival-timing/)
      expect(current?.base.length).toBeGreaterThan(0)
      expect(current?.branch).not.toBe(current?.base)
    })

    test('begin while one is open rejects, and the open one stays', async () => {
      const { changeSet } = await make()
      await changeSet.begin('First')
      await expect(changeSet.begin('Second')).rejects.toThrow(/open/)
      expect((await changeSet.current())?.title).toBe('First')
    })

    test('a title that gives no branch name rejects, and nothing opens', async () => {
      const { changeSet } = await make()
      await expect(changeSet.begin('!!!')).rejects.toThrow()
      expect(await changeSet.current()).toBeUndefined()
    })

    test('record, checkpoint, ship, spend and raiseCap reject with nothing open', async () => {
      const { changeSet } = await make()
      await expect(changeSet.record([TUNING])).rejects.toThrow()
      await expect(changeSet.checkpoint('nothing')).rejects.toThrow()
      await expect(changeSet.ship({ title: 'x', body: '' })).rejects.toThrow()
      await expect(changeSet.spend(10)).rejects.toThrow()
      await expect(changeSet.raiseCap(1_000_000)).rejects.toThrow()
    })

    test('recorded files are listed once each, sorted, with the tokens it has used and its cap', async () => {
      const { changeSet, edit } = await withEdit()
      await edit('content/feel/juice.toml', 'shake = 0.2\n')
      await changeSet.record(['content/feel/juice.toml', TUNING])
      const [summary, ...rest] = await changeSet.list()
      expect(rest).toEqual([])
      expect(summary).toMatchObject({
        title: 'Faster',
        files: ['content/feel/juice.toml', TUNING],
        created: [],
        tokens: { used: 0 },
      })
      expect(summary?.branch).toBe((await changeSet.current())?.branch)
      expect(summary?.tokens.cap).toBeGreaterThan(0)
    })

    test('spend adds what a proposal used, kept or not; a count that is not a whole number of zero or more rejects', async () => {
      const { changeSet } = await withEdit()
      await changeSet.spend(312)
      await changeSet.spend(0)
      await changeSet.spend(88)
      await expect(changeSet.spend(-1)).rejects.toThrow()
      await expect(changeSet.spend(1.5)).rejects.toThrow()
      expect((await changeSet.list())[0]?.tokens.used).toBe(400)
    })

    test('raiseCap only raises the cap; a cap not above the current one rejects and changes nothing', async () => {
      const { changeSet } = await withEdit()
      const cap = (await changeSet.list())[0]?.tokens.cap ?? 0
      await expect(changeSet.raiseCap(cap)).rejects.toThrow()
      await expect(changeSet.raiseCap(cap - 1)).rejects.toThrow()
      expect((await changeSet.list())[0]?.tokens.cap).toBe(cap)
      await changeSet.raiseCap(cap + 50_000)
      expect((await changeSet.list())[0]?.tokens.cap).toBe(cap + 50_000)
    })

    test('a checkpoint gives a commit; one with nothing recorded since gives the same commit again', async () => {
      const { changeSet } = await withEdit()
      const { commit } = await changeSet.checkpoint('MAX_MOVE_SPEED 6 to 7.5')
      expect(commit.length).toBeGreaterThan(0)
      expect((await changeSet.checkpoint('nothing new')).commit).toBe(commit)
    })

    test('ship pushes the branch, gives a compare link, and leaves the change set open', async () => {
      const { changeSet } = await withEdit()
      const branch = (await changeSet.current())?.branch ?? ''
      const shipped = await changeSet.ship({ title: 'Tuning: faster', body: 'MAX_MOVE_SPEED 6 to 7.5.' })
      expect(shipped.branch).toBe(branch)
      expect(shipped.pushed).toBe(true)
      expect(shipped.compareUrl).toContain(branch)
      expect((await changeSet.current())?.branch).toBe(branch)
    })

    test('close refuses while a recorded edit has no checkpoint, and the change set stays open', async () => {
      const { changeSet } = await withEdit()
      await expect(changeSet.close()).rejects.toThrow(/checkpoint/)
      expect((await changeSet.current())?.title).toBe('Faster')
    })

    test('close after a checkpoint ends it: nothing is open or listed, and a new one can begin', async () => {
      const { changeSet } = await withEdit()
      await changeSet.checkpoint('MAX_MOVE_SPEED 6 to 7.5')
      await changeSet.close()
      expect(await changeSet.current()).toBeUndefined()
      expect(await changeSet.list()).toEqual([])
      await changeSet.begin('Slower')
      expect((await changeSet.list())[0]).toMatchObject({ title: 'Slower', files: [], tokens: { used: 0 } })
    })

    test('writes recorded with their text are listed in order, each with its before and after text', async () => {
      const { changeSet, edit } = await withEdit()
      await edit(TUNING, 'MAX_MOVE_SPEED = 8\n')
      await changeSet.record(
        [TUNING],
        [{ path: TUNING, before: 'MAX_MOVE_SPEED = 7.5\n', after: 'MAX_MOVE_SPEED = 8\n' }],
      )
      await edit('content/feel/juice.toml', 'shake = 0.2\n')
      await changeSet.record(
        ['content/feel/juice.toml'],
        [{ path: 'content/feel/juice.toml', before: undefined, after: 'shake = 0.2\n' }],
      )
      const [summary] = await changeSet.list()
      expect(summary?.writes).toEqual([
        { path: TUNING, before: 'MAX_MOVE_SPEED = 7.5\n', after: 'MAX_MOVE_SPEED = 8\n' },
        { path: 'content/feel/juice.toml', before: undefined, after: 'shake = 0.2\n' },
      ])
      expect(summary?.files).toEqual(['content/feel/juice.toml', TUNING])
    })

    test('note keeps the latest run per check id, sorted by id, with its measures before and after', async () => {
      const { changeSet } = await withEdit()
      expect((await changeSet.list())[0]?.checks).toEqual([])
      const fair = { id: 'gap', label: 'Widest gap', value: 3, ok: true }
      await changeSet.note([
        { check: 'fairness', status: 'pass', findings: [], before: [fair], after: [{ ...fair, value: 4 }] },
        { check: 'content', status: 'fail', findings: [{ severity: 'error', message: 'bad' }] },
      ])
      await changeSet.note([{ check: 'content', status: 'pass', findings: [] }])
      expect((await changeSet.list())[0]?.checks).toEqual([
        { check: 'content', status: 'pass', findings: [] },
        { check: 'fairness', status: 'pass', findings: [], before: [fair], after: [{ ...fair, value: 4 }] },
      ])
    })

    test('note rejects with nothing open; a new change set starts with no writes or checks', async () => {
      const { changeSet } = await withEdit()
      await changeSet.note([{ check: 'content', status: 'pass', findings: [] }])
      await changeSet.checkpoint('Faster')
      await changeSet.close()
      await expect(changeSet.note([{ check: 'content', status: 'pass', findings: [] }])).rejects.toThrow()
      await changeSet.begin('Slower')
      expect((await changeSet.list())[0]).toMatchObject({ writes: [], checks: [] })
    })

    test('close with nothing open does nothing', async () => {
      const { changeSet } = await make()
      await expect(changeSet.close()).resolves.toBeUndefined()
      expect(await changeSet.current()).toBeUndefined()
    })
  })
}
