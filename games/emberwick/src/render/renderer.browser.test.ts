import '../no-eval.ts'
import { createPixiRenderer } from '@mcthaydt/automata-render-pixi'
import type { RenderTarget } from '@mcthaydt/automata-runtime'
import type { StepResult } from '@mcthaydt/automata-sim'
import { Effect } from 'effect'
import { Container, Sprite, Texture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { ROOM } from '../../fixtures/hand-written-room.ts'
import { parseRoom } from '../content/room.ts'
import { createRenderer, type Renderer } from './renderer.ts'
import { sceneRenderer } from './scene-renderer.ts'

// The renderer in a real browser (WebGL), for what a demo relies on: an extra drawing layer that is lit like
// the room and hears every step, frame and reset.

const step = (tick: number): StepResult =>
  ({
    tick,
    events: [],
    rejected: [],
    render: { resync: false, added: [], changed: [], removed: [] },
  }) as never

let renderer: Renderer | null = null
afterEach(() => {
  renderer?.destroy()
  renderer = null
})

describe('a demo layer', () => {
  it('draws inside the lit room, below the light map, and hears steps, frames and resets', async () => {
    const host = document.createElement('div')
    host.style.width = '640px'
    host.style.height = '384px'
    document.body.append(host)
    renderer = await createRenderer(host, parseRoom(ROOM))
    const heard: string[] = []
    const view = new Container()
    view.addChild(new Sprite(Texture.WHITE))
    const remove = renderer.addLayer({
      view,
      apply: (result) => heard.push(`apply:${result.tick}`),
      draw: () => heard.push('draw'),
      reset: () => heard.push('reset'),
    })
    expect(view.parent).not.toBeNull()
    expect(renderer.isLitByRoom(view)).toBe(true)
    renderer.apply(step(1))
    renderer.draw(0)
    renderer.reset()
    expect(heard).toEqual(['apply:1', 'draw', 'reset'])
    remove()
    expect(view.parent).toBeNull()
    renderer.apply(step(2))
    expect(heard).toHaveLength(3)
  })

  it('is safe to remove after the renderer is destroyed, and a destroyed renderer forgets its layers', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const destroyed = await createRenderer(host, parseRoom(ROOM))
    const heard: string[] = []
    const remove = destroyed.addLayer({ view: new Container(), apply: () => heard.push('apply') })
    destroyed.destroy()
    destroyed.apply(step(1))
    expect(heard).toEqual([])
    expect(() => remove()).not.toThrow()
  })
})

// Emberwick's scene inside render-pixi's renderer (DX.3): what `startGame` draws with.
describe('the scene on a render-pixi stage', () => {
  it('draws the room on the stage and reports where Wick is after a step', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const usable = { x: 0, y: 0, width: 640, height: 384 }
    const geometry = {
      usable,
      formFactor: 'desktop',
      layout: { width: 640, height: 384 },
      insets: { top: 0, right: 0, bottom: 0, left: 0 },
      hostReserved: { left: 0, right: 0 },
      visualInsetBottom: 0,
      hiddenBarBottom: 0,
      keyboardResize: 0,
      visible: usable,
      scale: 1,
    }
    const target = {
      host,
      geometry: {
        geometry: { current: geometry },
        onChange: () => () => {},
        setHostDisplay: () => {},
        remeasure: () => {},
        dispose: () => {},
      },
      assets: { get: () => undefined },
    } as unknown as RenderTarget
    const frames: Array<{ x: number; y: number; tick: number }> = []
    const options = sceneRenderer(parseRoom(ROOM), (at) => frames.push(at))

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const renderer = yield* createPixiRenderer(options)(target)
          expect(renderer.stage.world.children.length).toBeGreaterThan(0)
          renderer.apply({
            tick: 1,
            events: [],
            rejected: [],
            render: {
              resync: true,
              added: [
                {
                  sid: 1,
                  components: {
                    player: { x: 40 * 256, y: 100 * 256, vx: 0, vy: 0, facing: 1, grounded: true },
                  },
                },
              ],
              changed: [],
              removed: [],
            },
          } as never)
          renderer.draw({ alpha: 0, frameMs: 16, paused: false })
        }),
      ),
    )
    expect(frames.at(-1)).toEqual({ x: 40, y: 100, tick: 1 })
  })
})
