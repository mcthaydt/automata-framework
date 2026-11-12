// Where the retro grade sits in the look: before core's DUEL snap (the default: the final frame is strictly DUEL) or after it
// (the old game's order: it snapped first and graded the snapped colours, so dark gradients stay smooth and the frame is no longer
// strictly the palette). The pass says which through `beforeSnap` on its registration.
import { beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
})

const registered = async (options: Record<string, unknown>) => {
  const { addRetroPass } = await import('#src/app/add-retro.ts')
  const { registeredLookPasses } = await import('@automata/3d')
  addRetroPass(options)
  return registeredLookPasses().find((pass) => pass.name === 'retro')
}

describe('the retro pass’s place in the look', { timeout: 60_000 }, () => {
  it('runs before the snap unless told otherwise', async () => {
    expect((await registered({}))?.beforeSnap).toBe(true)
    vi.resetModules()
    expect((await registered({ gradeAt: 'before-snap' }))?.beforeSnap).toBe(true)
  })

  it('runs after the snap when the game says `after-snap`', async () => {
    expect((await registered({ gradeAt: 'after-snap' }))?.beforeSnap).not.toBe(true)
  })

  it('refuses a place it does not know', async () => {
    const { addRetroPass } = await import('#src/app/add-retro.ts')
    expect(() => addRetroPass({ gradeAt: 'in-the-middle' as never })).toThrow(/gradeAt/)
  })
})
