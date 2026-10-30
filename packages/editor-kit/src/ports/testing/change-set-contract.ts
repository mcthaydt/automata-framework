import { describe, expect, test } from 'vitest'
import type { ChangeSet } from '../suite-ports'

/**
 * What every `ChangeSet` promises (editor suite spec §4.3, §4.5; The Last Light's `ChangeSets` at `92e6704`), run
 * against the in-memory fake and, in EDS.1d, the git adapter. `make` gives a fresh project with nothing open, whose
 * Ship can push (a local bare remote for the git adapter).
 */
export function describeChangeSet(name: string, make: () => Promise<ChangeSet> | ChangeSet): void {
  describe(`ChangeSet contract: ${name}`, () => {
    test('nothing is open at first, and the Review desk lists nothing', async () => {
      const changeSet = await make()
      expect(await changeSet.current()).toBeUndefined()
      expect(await changeSet.list()).toEqual([])
    })

    test('begin opens one: its title, a branch named from it, and the base it started from', async () => {
      const changeSet = await make()
      await changeSet.begin('Bay: arrival timing')
      const current = await changeSet.current()
      expect(current?.title).toBe('Bay: arrival timing')
      expect(current?.branch).toMatch(/arrival-timing/)
      expect(current?.base.length).toBeGreaterThan(0)
      expect(current?.branch).not.toBe(current?.base)
    })

    test('begin while one is open rejects, and the open one stays', async () => {
      const changeSet = await make()
      await changeSet.begin('First')
      await expect(changeSet.begin('Second')).rejects.toThrow(/open/)
      expect((await changeSet.current())?.title).toBe('First')
    })

    test('a title that gives no branch name rejects, and nothing opens', async () => {
      const changeSet = await make()
      await expect(changeSet.begin('!!!')).rejects.toThrow()
      expect(await changeSet.current()).toBeUndefined()
    })

    test('record, checkpoint and ship reject with nothing open', async () => {
      const changeSet = await make()
      await expect(changeSet.record(['content/tuning.toml'])).rejects.toThrow()
      await expect(changeSet.checkpoint('nothing')).rejects.toThrow()
      await expect(changeSet.ship({ title: 'x', body: '' })).rejects.toThrow()
    })

    test('recorded files are listed once each, sorted, with the tokens it has used and its cap', async () => {
      const changeSet = await make()
      await changeSet.begin('Faster')
      await changeSet.record(['content/tuning.toml', 'content/feel/juice.toml'])
      await changeSet.record(['content/tuning.toml'])
      const [summary, ...rest] = await changeSet.list()
      expect(rest).toEqual([])
      expect(summary).toMatchObject({
        title: 'Faster',
        files: ['content/feel/juice.toml', 'content/tuning.toml'],
        created: [],
        tokens: { used: 0 },
      })
      expect(summary?.branch).toBe((await changeSet.current())?.branch)
      expect(summary?.tokens.cap).toBeGreaterThan(0)
    })

    test('a checkpoint gives a commit; one with nothing recorded since gives the same commit again', async () => {
      const changeSet = await make()
      await changeSet.begin('Faster')
      await changeSet.record(['content/tuning.toml'])
      const { commit } = await changeSet.checkpoint('MAX_MOVE_SPEED 6 to 7.5')
      expect(commit.length).toBeGreaterThan(0)
      expect((await changeSet.checkpoint('nothing new')).commit).toBe(commit)
    })

    test('ship pushes the branch, gives a compare link, and leaves the change set open', async () => {
      const changeSet = await make()
      await changeSet.begin('Faster')
      await changeSet.record(['content/tuning.toml'])
      const branch = (await changeSet.current())?.branch
      const shipped = await changeSet.ship({ title: 'Tuning: faster', body: 'MAX_MOVE_SPEED 6 to 7.5.' })
      expect(shipped.branch).toBe(branch)
      expect(shipped.pushed).toBe(true)
      expect(shipped.compareUrl).toContain(branch)
      expect((await changeSet.current())?.branch).toBe(branch)
    })

    test('close ends it: nothing is open or listed, and a new one can begin', async () => {
      const changeSet = await make()
      await changeSet.begin('Faster')
      await changeSet.record(['content/tuning.toml'])
      await changeSet.close()
      expect(await changeSet.current()).toBeUndefined()
      expect(await changeSet.list()).toEqual([])
      await changeSet.begin('Slower')
      expect((await changeSet.list())[0]).toMatchObject({ title: 'Slower', files: [] })
    })
  })
}
