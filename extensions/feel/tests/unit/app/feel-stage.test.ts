// feelStage plays the feel table on the Pixi stage: the shake moves the world, the flash and tint are drawn over the
// playfield, and cues and rumbles go to the game's own ports. It never writes the sim.
import type { PixiStage, StageCharacters } from '@automata/framework'
import { fakeClock } from '@automata/framework/testing'
import type { SimEvent, StepResult } from '@automata/sim'
import { CanvasTextMetrics, Container, Text } from 'pixi.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { feelStage } from '#src/app/feel-stage.ts'
import type { FeelFrame } from '#src/features/frame/feel.ts'
import { content, slam } from '#src/testing/feel-table.ts'

const noCharacters: StageCharacters = {
  point: () => undefined,
  squash: () => undefined,
  rest: () => undefined,
  hold: () => undefined,
}
const fakeStage = (): PixiStage =>
  ({
    world: new Container(),
    ui: new Container(),
    hud: new Container(),
    hudScale: () => ({ cssPerLogical: 3, devicePerCss: 1, hostScale: 1 }),
    backdrop: new Container(),
    characters: noCharacters,
  }) as unknown as PixiStage

// Words are canvas text, and Node has no 2D canvas to measure a `Text` with; a fixed advance per letter stands in. No
// baked page loads here either, so every word draws in the fallback face: the framework's browser tests cover the
// bitmap path, and the complete-game journeys play the real thing.
beforeEach(() => {
  vi.spyOn(CanvasTextMetrics, 'measureText').mockImplementation(((value: string, style: { fontSize: number }) => ({
    width: [...value].length * 5,
    height: style.fontSize * 1.2,
  })) as never)
})
afterEach(() => vi.restoreAllMocks())

const step = (tick: number, events: readonly SimEvent[]): StepResult =>
  ({ tick, events, render: {}, rejected: [] }) as unknown as StepResult

const setup = (extra: Partial<Parameters<typeof feelStage>[0]> = {}) => {
  const stage = fakeStage()
  const clock = fakeClock()
  const hooks = feelStage({ content: () => content, clock, ...extra })(stage)
  return { stage, clock, hooks }
}

describe('feelStage', () => {
  it('shakes the world while the table says so, then puts it back', () => {
    const { stage, clock, hooks } = setup()
    stage.world.position.set(10, 20)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    const moved = stage.world.pivot.x !== 0 || stage.world.pivot.y !== 0
    expect(moved).toBe(true)
    // Whoever places the world (the letterbox, a camera) keeps doing so: the shake never touches its position.
    expect([stage.world.position.x, stage.world.position.y]).toEqual([10, 20])
    for (let i = 0; i < 120; i += 1) {
      clock.advance(50)
      hooks.draw?.({ alpha: 0, frameMs: 50, paused: false })
    }
    expect([stage.world.pivot.x, stage.world.pivot.y]).toEqual([0, 0])
  })

  it('shakes the same on screen whatever scale the world is drawn at, and when a camera rewrites its position every frame', () => {
    const { stage, hooks } = setup()
    stage.world.scale.set(2)
    stage.world.position.set(100, 100)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    const at = stage.world.toGlobal({ x: 0, y: 0 })
    // The screen moved by the shake (a few pixels), not by twice that.
    expect(Math.abs(at.x - 100)).toBeLessThanOrEqual(3 + 1e-6)
    expect(Math.abs(at.y - 100)).toBeLessThanOrEqual(3 + 1e-6)
  })

  it('draws the flash over the playfield for as long as it lasts', () => {
    const { stage, hooks } = setup()
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    expect(stage.ui.children.length).toBeGreaterThan(0)
    expect(stage.ui.children.some((child) => child.visible && child.alpha > 0)).toBe(true)
  })

  it('tells a watcher what it drew on each frame, the flash and the shake included', () => {
    const seen: FeelFrame[] = []
    const { hooks } = setup({ onFrame: (frame) => void seen.push(frame) })
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.flash).toBeNull()
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    expect(seen).toHaveLength(2)
    expect(seen[1]?.flash).not.toBeNull()
    expect(seen[1]?.offset).not.toEqual([0, 0])
  })

  it('hands the cues and rumbles to the game’s ports, once', () => {
    const onCue = vi.fn()
    const onHaptic = vi.fn()
    const { clock, hooks } = setup({ onCue, onHaptic })
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    clock.advance(16)
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    expect(onCue).toHaveBeenCalledTimes(1)
    expect(onCue).toHaveBeenCalledWith('slam')
    expect(onHaptic).toHaveBeenCalledTimes(1)
  })

  it('does nothing with an event the table does not know', () => {
    const { stage, hooks } = setup()
    stage.world.position.set(3, 4)
    hooks.apply?.(step(1, [{ type: 'nothing.happens', payload: {} } as unknown as SimEvent]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    expect([stage.world.pivot.x, stage.world.pivot.y]).toEqual([0, 0])
  })

  it('reads the table at each event, so a saved change shows on the next one', () => {
    let table = { ...content, entry: [] } as typeof content
    const stage = fakeStage()
    const hooks = feelStage({ content: () => table, clock: fakeClock() })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    expect(stage.world.pivot.x).toBe(0)
    table = content
    hooks.apply?.(step(2, [slam(7)]))
    hooks.draw?.({ alpha: 0, frameMs: 16, paused: false })
    expect(stage.world.pivot.x !== 0 || stage.world.pivot.y !== 0).toBe(true)
  })
})

// A stage with the one thing the renderer gives characters: its port. Feel never reaches for the 2D consumer, so a
// stage that throws on it stands for a 3D renderer, whose characters are not the consumer's views.
const withViews = (views: Record<number, Container>) => {
  const held: ReadonlySet<number>[] = []
  const calls: string[] = []
  const resting = new Map<number, { x: number; y: number }>()
  const characters: StageCharacters = {
    point: (ref) => (views[ref] === undefined ? undefined : { x: views[ref].x, y: views[ref].y }),
    squash(ref, x, y) {
      const view = views[ref]
      if (view === undefined) return
      const base = resting.get(ref) ?? { x: view.scale.x, y: view.scale.y }
      resting.set(ref, base)
      view.scale.set(base.x * x, base.y * y)
      calls.push(`squash ${ref}`)
    },
    rest(ref) {
      const base = resting.get(ref)
      if (base === undefined) return
      views[ref]?.scale.set(base.x, base.y)
      resting.delete(ref)
      calls.push(`rest ${ref}`)
    },
    hold: (refs) => void held.push(refs),
  }
  const stage = {
    ...fakeStage(),
    characters,
    get consumer(): never {
      throw new Error('Feel reached for the 2D consumer')
    },
  } as unknown as PixiStage
  return { stage, held, calls }
}
const frameInfo = { alpha: 0, frameMs: 16, paused: false }

describe('feelStage: hit-stop', () => {
  it('holds the subject’s view while the hit-stop lasts, and lets it go after', () => {
    const { stage, held } = withViews({ 7: new Container() })
    const clock = fakeClock()
    const hooks = feelStage({ content: () => content, clock })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    expect([...(held.at(-1) ?? [])]).toEqual([7])
    for (let i = 0; i < 20; i += 1) {
      clock.advance(16)
      hooks.draw?.(frameInfo)
    }
    expect([...(held.at(-1) ?? [])]).toEqual([])
  })

  it('lets every view go when it starts over', () => {
    const { stage, held } = withViews({ 7: new Container() })
    const hooks = feelStage({ content: () => content, clock: fakeClock() })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    hooks.reset?.()
    expect([...(held.at(-1) ?? [])]).toEqual([])
  })
})

describe('feelStage: squash', () => {
  it('squashes the subject’s view while it springs, and puts its scale back at rest', () => {
    const view = new Container()
    view.scale.set(2, 3)
    const { stage } = withViews({ 7: view })
    const clock = fakeClock()
    const hooks = feelStage({ content: () => content, clock })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    let squashed = false
    for (let i = 0; i < 12; i += 1) {
      clock.advance(16)
      hooks.draw?.(frameInfo)
      if (view.scale.x !== 2 || view.scale.y !== 3) squashed = true
    }
    expect(squashed).toBe(true)
    for (let i = 0; i < 400; i += 1) {
      clock.advance(16)
      hooks.draw?.(frameInfo)
    }
    expect([view.scale.x, view.scale.y]).toEqual([2, 3])
  })

  it('squashes while it springs, then rests the character once it is done', () => {
    const { stage, calls } = withViews({ 7: new Container() })
    const clock = fakeClock()
    const hooks = feelStage({ content: () => content, clock })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    for (let i = 0; i < 400; i += 1) {
      clock.advance(16)
      hooks.draw?.(frameInfo)
    }
    expect(calls[0]).toBe('squash 7')
    // The spring passes through rest on its way (each time the character is put back), and ends there.
    expect(calls).toContain('rest 7')
    expect(calls.at(-1)).toBe('rest 7')
  })

  it('does nothing for a subject that has no view', () => {
    const { stage } = withViews({})
    const hooks = feelStage({ content: () => content, clock: fakeClock() })(stage)
    hooks.apply?.(step(1, [slam(99)]))
    expect(() => hooks.draw?.(frameInfo)).not.toThrow()
  })
})

describe('feelStage: words', () => {
  const said = {
    ...content,
    entry: [{ on: 'slam', word: [{ key: 'slam.word', words: 'Ouch!', at: 'subject' as const }] }],
  }
  // One container per label on the hud; the fill is the last Text in it (the shadow comes first).
  const texts = (stage: PixiStage): Text[] =>
    stage.hud.children
      .filter((label) => label.visible)
      .map((label) => label.children.filter((c): c is Text => c instanceof Text && c.visible).at(-1) as Text)
  // A word is anchored by the middle of its bottom edge: that is the point the table places.
  const anchorOf = (t: Text | undefined) => ({ x: (t?.x ?? 0) + (t?.width ?? 0) / 2, y: (t?.y ?? 0) + (t?.height ?? 0) })

  it('shows a word over its subject’s view and takes it away when its time is up', () => {
    const view = new Container()
    view.position.set(40, 60)
    const { stage } = withViews({ 7: view })
    stage.world.addChild(view)
    const clock = fakeClock()
    const hooks = feelStage({ content: () => said, clock })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    const [word] = texts(stage)
    expect(word?.text).toBe('Ouch!')
    expect(Math.abs(anchorOf(word).x - 40)).toBeLessThan(1)
    expect(anchorOf(word).y).toBeLessThan(60)
    for (let i = 0; i < 80; i += 1) {
      clock.advance(16)
      hooks.draw?.(frameInfo)
    }
    expect(texts(stage)).toHaveLength(0)
  })

  it('says it in the player’s language when the game can translate it', () => {
    const { stage } = withViews({ 7: new Container() })
    const asked: unknown[] = []
    const hooks = feelStage({
      content: () => said,
      clock: fakeClock(),
      translate: (path, authored) => {
        asked.push([path, authored])
        return 'Aïe !'
      },
    })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    expect(texts(stage)[0]?.text).toBe('Aïe !')
    expect(asked[0]).toEqual([['entry', 0, 'word', 0, 'words'], 'Ouch!'])
  })

  it('draws a word with no subject in the middle of the playfield, and skips one that has no words', () => {
    const table = {
      ...content,
      entry: [
        {
          on: 'slam',
          word: [{ key: 'a', words: 'Mid' }, { key: 'b' }],
        },
      ],
    }
    const { stage } = withViews({})
    const hooks = feelStage({ content: () => table, clock: fakeClock(), size: { width: 200, height: 100 } })(
      stage,
    )
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    const shown = texts(stage)
    expect(shown.map((t) => t.text)).toEqual(['Mid'])
    expect([anchorOf(shown[0]).x, anchorOf(shown[0]).y]).toEqual([100, 50])
  })

  it('holds a word still for reduced motion', () => {
    const view = new Container()
    const { stage } = withViews({ 7: view })
    const clock = fakeClock()
    const hooks = feelStage({ content: () => said, clock, reducedMotion: () => true })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    const before = texts(stage)[0]?.y
    clock.advance(200)
    hooks.draw?.(frameInfo)
    expect(texts(stage)[0]?.y).toBe(before)
  })

  it('draws words on the hud layer, not in the picture, so the flash and tint cannot wash them out', () => {
    const { stage } = withViews({ 7: new Container() })
    const hooks = feelStage({ content: () => said, clock: fakeClock() })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    expect(texts(stage)).toHaveLength(1)
    expect(stage.ui.children.some((child) => child instanceof Text)).toBe(false)
    expect(stage.hud.children).toHaveLength(1)
  })

  it('draws a word at least 14 CSS px tall even when a logical pixel is smaller than a CSS pixel', () => {
    const { stage } = withViews({ 7: new Container() })
    stage.hudScale = () => ({ cssPerLogical: 0.77, devicePerCss: 3, hostScale: 1 })
    const hooks = feelStage({ content: () => said, clock: fakeClock() })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    expect(texts(stage)[0]?.style.fontSize).toBeCloseTo(14 / 0.77, 3)
  })

  it('puts a dark shadow behind a word', () => {
    const { stage } = withViews({ 7: new Container() })
    const hooks = feelStage({ content: () => said, clock: fakeClock() })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    const label = stage.hud.children[0]
    const [shadow, fill] = (label?.children ?? []).filter((c): c is Text => c instanceof Text && c.visible)
    expect(shadow?.style.fill).toBe(0x000000)
    expect(fill?.style.fill).toBe(0xffffff)
  })

  it('draws a Chinese word in the device face and still shows it', () => {
    const { stage } = withViews({ 7: new Container() })
    const hooks = feelStage({
      content: () => said,
      clock: fakeClock(),
      translate: () => '好痛！',
    })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    expect(texts(stage)[0]?.text).toBe('好痛！')
  })

  it('hides every word when it starts over', () => {
    const { stage } = withViews({ 7: new Container() })
    const hooks = feelStage({ content: () => said, clock: fakeClock() })(stage)
    hooks.apply?.(step(1, [slam(7)]))
    hooks.draw?.(frameInfo)
    expect(texts(stage)).toHaveLength(1)
    hooks.reset?.()
    expect(texts(stage)).toHaveLength(0)
  })
})
