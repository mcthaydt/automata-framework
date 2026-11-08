import { Text } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { createHudText } from '#src/features/hud-text/hud-text.ts'
import { disposeAll, edgeRun, frame, inkBox, startRenderer } from './harness.ts'

// Canvas text on a real WebGL2 renderer (spec §5): a stem's edge is at most 2 device px wide at any root scale and
// device pixel ratio, where the same letters inside the pixel picture are as blurry as the picture is small.
const hasWebgl2 = document.createElement('canvas').getContext('webgl2') !== null
const STYLE = { size: 8, floor: 12, color: 0xffffff, shadow: false } as const
const LOGICAL = { width: 320, height: 180 }

describe.skipIf(!hasWebgl2)('crisp canvas text', () => {
  afterEach(disposeAll)

  describe.each([
    [{ width: 522, height: 300 }, 2],
    [{ width: 1280, height: 720 }, 2],
    [{ width: 522, height: 300 }, 3],
    [{ width: 1280, height: 720 }, 3],
  ])('at %o and a device pixel ratio of %i', (view, dpr) => {
    it('keeps the edge of a stem within 2 device px', async () => {
      const { renderer } = await startRenderer({ view, logical: LOGICAL, dpr })
      const hud = createHudText(renderer.stage)
      await hud.ready
      const label = hud.label()
      label.set('Ill', 40, 60, STYLE)
      expect(label.kind).toBe('bitmap')
      expect(edgeRun(frame(renderer))).toBeLessThanOrEqual(2)
    })
  })

  it('reads at least 8 CSS px tall on a phone held upright, where the same letter in the picture is under 6', async () => {
    const view = { width: 393, height: 659 }
    const logical = { width: 512, height: 256 }
    const hudRun = await startRenderer({ view, logical, dpr: 2 })
    const hud = createHudText(hudRun.renderer.stage)
    await hud.ready
    hud.label().set('I', 40, 60, STYLE)
    const crisp = inkBox(frame(hudRun.renderer))
    const pictureRun = await startRenderer({ view, logical, dpr: 2 })
    pictureRun.renderer.stage.ui.addChild(
      Object.assign(new Text({ text: 'I', style: { fontSize: 8, fill: 0xffffff, fontWeight: '600' } }), {
        x: 40,
        y: 60,
      }),
    )
    const blurry = inkBox(frame(pictureRun.renderer))
    // Device px at the renderer's resolution of 2.
    expect(((crisp?.maxY ?? 0) - (crisp?.minY ?? 0) + 1) / 2).toBeGreaterThanOrEqual(8)
    expect(((blurry?.maxY ?? 99) - (blurry?.minY ?? 0) + 1) / 2).toBeLessThan(6)
  })

  it('keeps the edge and the floor after the view turns', async () => {
    const { renderer, resize } = await startRenderer({
      view: { width: 1280, height: 720 },
      logical: LOGICAL,
      dpr: 2,
    })
    const hud = createHudText(renderer.stage)
    await hud.ready
    const label = hud.label()
    label.set('Ill', 40, 60, STYLE)
    resize(522, 300)
    const box = label.set('Ill', 40, 60, STYLE)
    const { cssPerLogical } = renderer.stage.hudScale()
    // The label's font is at least 12 CSS px; its box is the line height of that font.
    expect(box.height * cssPerLogical).toBeGreaterThanOrEqual(12)
    expect(edgeRun(frame(renderer))).toBeLessThanOrEqual(2)
  })

  it('draws every letter of a Latin and a Cyrillic string from a baked page', async () => {
    const { renderer } = await startRenderer({ view: { width: 1280, height: 720 }, logical: LOGICAL, dpr: 2 })
    const hud = createHudText(renderer.stage)
    await hud.ready
    const label = hud.label()
    for (const letter of [...'Ça va ?Ł']) {
      if (letter === ' ') continue
      label.set(letter, 40, 60, STYLE)
      expect(label.kind).toBe('bitmap')
      expect(inkBox(frame(renderer)), `latin ${letter}`).toBeDefined()
    }
    label.set('П', 40, 60, STYLE)
    // The cyrillic page loads on its first use; until it arrives the letter draws in the device's face.
    await new Promise((resolve) => setTimeout(resolve, 0))
    for (let tries = 0; tries < 50 && label.kind !== 'bitmap'; tries++) {
      await new Promise((resolve) => setTimeout(resolve, 20))
      label.set('П', 40, 60, STYLE)
    }
    for (const letter of [...'Привет']) {
      label.set(letter, 40, 60, STYLE)
      expect(label.kind).toBe('bitmap')
      expect(inkBox(frame(renderer)), `cyrillic ${letter}`).toBeDefined()
    }
  })

  it('draws a Chinese character in the device face, sharp enough to see', async () => {
    const { renderer } = await startRenderer({ view: { width: 1280, height: 720 }, logical: LOGICAL, dpr: 2 })
    const hud = createHudText(renderer.stage)
    await hud.ready
    const label = hud.label()
    label.set('好', 40, 60, STYLE)
    expect(label.kind).toBe('fallback')
    expect(inkBox(frame(renderer))).toBeDefined()
  })
})
