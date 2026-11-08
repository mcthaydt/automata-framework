// feelStage plays the feel table on the Pixi stage: the shake moves the world, the flash and tint are drawn over the
// playfield, and cues and rumbles go to the game's own ports. It never writes the sim.
import type { PixiStage } from '@automata/framework'
import { fakeClock } from '@automata/framework/testing'
import type { SimEvent, StepResult } from '@automata/sim'
import { Container, Text } from 'pixi.js'
import { describe, expect, it, vi } from 'vitest'
import { feelStage } from '#src/app/feel-stage.ts'
import type { FeelFrame } from '#src/features/frame/feel.ts'
import { content, slam } from '#src/testing/feel-table.ts'

const fakeStage = (): PixiStage =>
  ({ world: new Container(), ui: new Container(), backdrop: new Container() }) as unknown as PixiStage

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

// A stage with the one thing the renderer's consumer gives a view: the view of an entity, and a hold on it.
const withViews = (views: Record<number, Container>) => {
  const held: ReadonlySet<number>[] = []
  const stage = {
    ...fakeStage(),
    consumer: {
      viewOf: (sid: number) => (views[sid] === undefined ? undefined : { container: views[sid] }),
      hold: (sids: ReadonlySet<number>) => void held.push(sids),
    },
  } as unknown as PixiStage
  return { stage, held }
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
  const texts = (stage: PixiStage): Text[] =>
    stage.ui.children.filter((c): c is Text => c instanceof Text && c.visible)

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
    expect(Math.abs((word?.x ?? 0) - 40)).toBeLessThan(1)
    expect(word?.y ?? 99).toBeLessThan(60)
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
    expect([shown[0]?.x, shown[0]?.y]).toEqual([100, 50])
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
})
