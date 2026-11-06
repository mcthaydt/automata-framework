import { describe, expect, it } from 'vitest'
import { levelFile, shareItems, shareLevel } from '#src/features/share/share-model.ts'
import { createDownloadStore } from '#src/shared/kit/storage/download-store.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import { levelProject } from '#src/shared/level-2d/profiles/level-project/level-project.ts'
import { platformerTemplate } from '#src/shared/level-2d/profiles/level-project/templates/platformer.ts'
import type { Profile } from '#src/shared/level-2d/profiles/profile.ts'

const profile = levelProject as Profile<unknown>
const project = { ...platformerTemplate.create(counterIds()), name: 'Rooftops' }

describe('the Share menu', () => {
  it("sends the level's own file, named after it", () => {
    expect(levelFile(profile, project, '')).toMatchObject({ path: 'rooftops.af2d.json' })
  })

  it('offers Download, Share and Copy, and says why Share is off where the device cannot share', () => {
    expect(shareItems(true).map((item) => [item.label, item.disabled ?? false])).toEqual([
      ['Download', false],
      ['Share', false],
      ['Copy', false],
    ])
    expect(shareItems(false)[1]).toMatchObject({ disabled: true, reason: "This device can't share files." })
  })

  it('says in plain words what each did, and passes a refusal on', async () => {
    const downloads: string[] = []
    const exports = createDownloadStore({ now: () => 0, download: (file) => void downloads.push(file.name) })
    const file = { path: 'rooftops.af2d.json', contents: '{}' }
    expect(await shareLevel('download', file, exports)).toEqual({
      ok: true,
      message: 'Downloaded your level.',
    })
    expect(downloads).toEqual(['rooftops.af2d.json'])
    // No clipboard here: the store's own message comes back.
    expect((await shareLevel('copy', file, exports)).ok).toBe(false)
  })
})
