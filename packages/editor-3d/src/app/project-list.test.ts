// The project list (ED3D.5b step 6; ED3D spec §8, kit spec §4.7): what Home shows of a workspace, one entry for each
// level, newest first, with what the checks found.
import { StorageError } from '@automata/editor/kit/core'
import { describe, expect, it } from 'vitest'
import { afSectorProfile } from '../profile/af-sector-profile'
import type { LevelProfile } from '../profile/level-profile'
import { loadAuthored } from '../testing/fixtures'
import { createTestClock, memoryWorkspace } from '../testing/memory-workspace'
import { problemCount } from './problem-count'
import { listProjects } from './project-list'

function countsOf<D>(text: string, profile: LevelProfile<D>) {
  const parsed = profile.parse(text)
  if (!parsed.ok) throw new Error('does not parse')
  const results = profile.checks(parsed.value)
  return { errors: problemCount(results, 'error'), warnings: problemCount(results, 'warning') }
}

describe('listProjects', () => {
  it('lists levels with their profile and check counts, and broken levels, newest first', async () => {
    const clock = createTestClock()
    const { store } = memoryWorkspace(clock)
    const write = async (path: string, data: string | Uint8Array) => {
      await store.write(path, data)
      clock.advance(10)
    }
    const depot = loadAuthored('depot.af-sector')
    await write('depot.af-sector.json', depot)
    await write('art/annex/annex.json', depot)
    await write('broken.json', depot.replace('"floor": 0', '"floor": "low"'))
    await write('notes.json', '{"todo": []}')
    await write('art/clinic.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
    await write('readme.md', '# hello')
    // Only `.json` files are read: a level under another extension is not listed.
    await write('depot.txt', depot)
    await write('binary.json', new Uint8Array([0xff]))

    const entries = await listProjects(store)
    expect(entries.map((entry) => [entry.path, entry.status])).toEqual([
      ['broken.json', 'broken'],
      ['art/annex/annex.json', 'ok'],
      ['depot.af-sector.json', 'ok'],
    ])
    expect(entries[2]).toEqual({
      status: 'ok',
      path: 'depot.af-sector.json',
      size: new TextEncoder().encode(depot).byteLength,
      mtime: 1_700_000_000_000,
      profile: 'af-sector',
      ...countsOf(depot, afSectorProfile),
    })
    expect(entries[1]).toMatchObject({ profile: 'af-sector', ...countsOf(depot, afSectorProfile) })
    expect(entries[0]).toMatchObject({
      profile: 'af-sector',
      message: 'sectors.0.floor: Invalid input: expected number, received string',
    })
  })

  it('rejects with the store’s error when the workspace cannot be listed', async () => {
    const { store } = memoryWorkspace(createTestClock())
    const failing = { ...store, list: () => Promise.reject(new StorageError('denied', 'no')) }
    await expect(listProjects(failing)).rejects.toThrow('no')
  })
})
