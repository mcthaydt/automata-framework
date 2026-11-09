import { CanvasTextMetrics, Container } from 'pixi.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as choose from '#src/features/hud-text/choose-page.ts'
import { createLabel, type LabelHost } from '#src/features/hud-text/hud-label.ts'

// Wrap the real functions so a call can be counted.
vi.mock('#src/features/hud-text/choose-page.ts', async (original) => {
  const real = await original<typeof import('#src/features/hud-text/choose-page.ts')>()
  return {
    ...real,
    normalise: vi.fn(real.normalise),
    choosePage: vi.fn(real.choosePage),
    missingFrom: vi.fn(real.missingFrom),
  }
})

const STYLE = { size: 10, floor: 14, color: 0xffffff, shadow: false } as const
const host = (): LabelHost => ({
  mount: (root: Container) => void new Container().addChild(root),
  hudScale: () => ({ cssPerLogical: 1, devicePerCss: 1, hostScale: 1 }),
  alive: () => true,
  family: () => undefined,
  face: () => 'sans-serif',
  missing: () => {},
})

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(CanvasTextMetrics, 'measureText').mockImplementation(((v: string, s: { fontSize: number }) => ({
    width: [...v].length * 5,
    height: s.fontSize,
  })) as never)
  vi.mocked(choose.normalise).mockClear()
  vi.mocked(choose.choosePage).mockClear()
})

describe('a label that draws the same string every frame', () => {
  it('normalises and chooses a page once, and again only when the string changes', () => {
    const label = createLabel(host())
    for (let frame = 0; frame < 30; frame++) label.set('Ouch, a wall!', 10, 10, STYLE)
    expect(choose.normalise).toHaveBeenCalledTimes(1)
    expect(choose.choosePage).toHaveBeenCalledTimes(1)
    label.set('Ouch!', 10, 10, STYLE)
    expect(choose.choosePage).toHaveBeenCalledTimes(2)
  })
})
