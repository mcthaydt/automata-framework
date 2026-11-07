// @vitest-environment jsdom
import { runGame } from '@automata/framework'
import { manualFrames, nullRenderer } from '@automata/framework/testing'
import { canonicalJson, hex64, xxhash64 } from '@automata/sim'
import { afterEach, describe, expect, it } from 'vitest'
import { stressParams } from '../../../stress/params.ts'
import { STRESS_CONTENT, STRESS_CONTENT_HASH, stressGame } from '../../../stress/stress-game.ts'

const until = async (condition: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 400 && !condition(); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  expect(condition()).toBe(true)
}

afterEach(() => {
  document.body.replaceChildren()
  document.documentElement.removeAttribute('data-state')
})

describe('stressParams (?entities=&systems=)', () => {
  it('defaults to 2000 entities and 8 systems', () => {
    expect(stressParams('')).toEqual({ entities: 2000, systems: 8, seed: 1 })
  })

  it('reads the query and refuses values out of range, keeping the default', () => {
    expect(stressParams('?entities=500&systems=3')).toEqual({ entities: 500, systems: 3, seed: 1 })
    expect(stressParams('?entities=0&systems=999')).toEqual({ entities: 2000, systems: 8, seed: 1 })
    expect(stressParams('?entities=abc&systems=2.5')).toEqual({ entities: 2000, systems: 8, seed: 1 })
  })
})

describe('stressGame (runGame, AppLoop, sim, entity views and UI)', () => {
  it("pins the content hash to the runtime's formula", () => {
    expect(hex64(xxhash64(new TextEncoder().encode(canonicalJson(STRESS_CONTENT))))).toBe(STRESS_CONTENT_HASH)
  })

  it('boots to ready, shows N entities and M systems, and ticks as frames advance', async () => {
    const root = document.createElement('div')
    document.body.appendChild(root)
    const frames = manualFrames()
    const handle = runGame(
      stressGame(
        { entities: 50, systems: 3, seed: 1 },
        { root, renderer: nullRenderer(), seams: { frames } },
      ),
    )
    await until(() => frames.pending)
    frames.advance(16.67)
    await until(() => document.documentElement.dataset.state === 'ready')
    await until(() => root.querySelector('[data-testid="stress-hud"]') !== null)

    const hud = root.querySelector<HTMLElement>('[data-testid="stress-hud"]') as HTMLElement
    expect(hud.dataset.stressEntities).toBe('50')
    expect(hud.dataset.stressSystems).toBe('3')
    expect(root.querySelector('[data-testid="pause"]')).not.toBeNull()

    for (let frame = 0; frame < 8; frame += 1) frames.advance(100)
    await until(() => Number(hud.dataset.stressTicks) >= 30)
    await handle.shutdown()
  })
})
