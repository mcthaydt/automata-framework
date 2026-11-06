import { type Filter, Sprite, Texture } from 'pixi.js'
import { describe, expect, it } from 'vitest'
import { CompositeTarget } from '#src/letterbox/composite-target.ts'
import { LetterboxFrame } from '#src/letterbox/letterbox.ts'

// From FloorFifty `tests/client/systems/render/render-target.test.ts` at `ac72660`; FloorFifty's fixed 960 × 540
// is the game's logical size here.
const SIZE = { width: 320, height: 180 }

describe('the composite target', () => {
  it('is exactly the logical size', () => {
    const target = new CompositeTarget(SIZE)
    expect(target.sprite.texture.width).toBe(SIZE.width)
    expect(target.sprite.texture.height).toBe(SIZE.height)
    target.destroy()
  })

  it("grows to the form factor's field and back", () => {
    const target = new CompositeTarget(SIZE)
    target.resize(240)
    expect(target.sprite.texture.width).toBe(SIZE.width)
    expect(target.sprite.texture.height).toBe(240)
    target.resize(SIZE.height)
    expect(target.sprite.texture.height).toBe(SIZE.height)
    target.destroy()
  })

  it('tells its sprite to redraw its quad when it resizes (a rotation)', () => {
    // Without this the sprite keeps the quad from its first frame, and the old size is stretched over the new.
    const target = new CompositeTarget(SIZE)
    const sprite = target.sprite as unknown as { didViewUpdate: boolean }
    sprite.didViewUpdate = false
    target.resize(240)
    expect(sprite.didViewUpdate).toBe(true)
    target.destroy()
  })

  it('renders at resolution one regardless of device pixel ratio', () => {
    const target = new CompositeTarget(SIZE)
    expect(target.sprite.texture.source.resolution).toBe(1)
    target.destroy()
  })

  it('never smooths its own upscale', () => {
    const target = new CompositeTarget(SIZE)
    expect(target.sprite.texture.source.scaleMode).toBe('nearest')
    target.destroy()
  })

  it('holds the filters it is given', () => {
    const target = new CompositeTarget(SIZE)
    expect(target.stage.filters).toEqual([])
    target.destroy()
  })

  it('pins filterArea to target dimensions to avoid recursive getBounds calculations', () => {
    const target = new CompositeTarget(SIZE)
    expect(target.stage.filterArea).toEqual(expect.objectContaining({ x: 0, y: 0, ...SIZE }))
    target.resize(240)
    expect(target.stage.filterArea).toEqual(
      expect.objectContaining({ x: 0, y: 0, width: SIZE.width, height: 240 }),
    )
    target.destroy()
  })

  it('moves the world and UI into the target and puts its sprite in the letterbox root', () => {
    const frame = new LetterboxFrame({ logicalWidth: SIZE.width, logicalHeight: SIZE.height })
    const target = new CompositeTarget(SIZE)
    target.adopt(frame)
    expect(frame.world.parent).toBe(target.stage)
    expect(frame.ui.parent).toBe(target.stage)
    expect(target.sprite.parent).toBe(frame.root)
    target.destroy()
    frame.destroy()
  })

  it('keeps a filtered UI child inside the composite with its own filters', () => {
    const frame = new LetterboxFrame({ logicalWidth: SIZE.width, logicalHeight: SIZE.height })
    const target = new CompositeTarget(SIZE)
    const filtered = new Sprite(Texture.EMPTY)
    const refraction = { label: 'refraction' } as unknown as Filter
    const paletteLock = { label: 'palette-lock' } as unknown as Filter
    filtered.filters = [refraction]
    frame.ui.addChild(filtered)

    target.adopt(frame)
    target.stage.filters = [paletteLock]

    expect(filtered.parent).toBe(frame.ui)
    expect(frame.ui.parent).toBe(target.stage)
    expect(filtered.filters).toEqual([refraction])
    expect(target.stage.filters).toEqual([paletteLock])
    target.destroy()
    frame.destroy()
  })
})
