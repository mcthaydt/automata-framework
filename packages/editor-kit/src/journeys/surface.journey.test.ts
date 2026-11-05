import '../tokens.css'
import '../fonts.css'
import { type MountedFixture, mountFixture, settleLayout } from '@mcthaydt/automata/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { createHistory } from '../history/history'
import { IPAD_PROFILES } from '../testing/ipad-profiles'
import JourneyFixture, { type JourneyState } from '../testing/JourneyFixture.svelte'
import { createPointers } from '../testing/pointers'

// EK-b and EK-i (kit spec §9) on the fixture's gesture surface, on an iPad 11" in landscape.

let mounted: MountedFixture | undefined
afterEach(async () => {
  await mounted?.unmount()
  mounted = undefined
})

interface Seen {
  readonly name: string
  readonly pointerType: string | undefined
}

async function open(): Promise<{ seen: Seen[]; surface: HTMLElement; detach: () => void }> {
  const [profile] = IPAD_PROFILES
  if (profile === undefined) throw new Error('no profile')
  await page.viewport(profile.width, profile.height)
  const seen: Seen[] = []
  let detach: () => void = () => {}
  mounted = mountFixture(JourneyFixture, {
    history: createHistory<JourneyState>({ hp: 3, volume: 50 }),
    onsurface: (name, event) =>
      seen.push({ name, pointerType: (event as { pointerType?: string }).pointerType }),
    ondetach: (stop) => {
      detach = stop
    },
  })
  await settleLayout()
  const surface = document.querySelector<HTMLElement>('[data-testid="surface"]')
  if (surface === null) throw new Error('no surface')
  return { seen, surface, detach: () => detach() }
}

describe('EK-b: a palm lands while the Pencil draws', () => {
  it('is ignored: the stroke is the Pencil’s alone, and the palm makes no gesture', async () => {
    const { seen, surface } = await open()
    const pointers = createPointers(surface)
    const pen = await pointers.down('pen', { x: 40, y: 40 }, { pressure: 0.6 })
    await pen.move({ x: 60, y: 40 })
    const palm = await pointers.palm({ x: 200, y: 120 })
    await pen.move({ x: 80, y: 40 })
    await palm.move({ x: 230, y: 130 })
    await pen.move({ x: 100, y: 40 })
    await palm.release()
    await pen.release()
    expect(seen.map((each) => each.name)).toEqual(['dragStart', 'drag', 'drag', 'dragEnd'])
    expect(seen.every((each) => each.pointerType === 'pen')).toBe(true)
  })
})

describe('EK-i: the surface is torn down mid-gesture', () => {
  it('fires nothing after the teardown, not even the end of the drag, and holds no pointer capture', async () => {
    const { seen, surface, detach } = await open()
    const finger = await createPointers(surface).down('touch', { x: 40, y: 40 })
    await finger.move({ x: 80, y: 40 })
    expect(seen.map((each) => each.name)).toEqual(['dragStart'])
    detach()
    await finger.move({ x: 120, y: 40 })
    await finger.release()
    expect(seen.map((each) => each.name)).toEqual(['dragStart'])
    expect(surface.hasPointerCapture(finger.id)).toBe(false)
  })
})
