import '../no-eval.ts'
import type { StepResult } from '@mcthaydt/automata-sim'
import { Container, Sprite, Texture } from 'pixi.js'
import { afterEach, describe, expect, it } from 'vitest'
import { parseRoom, ROOM } from '../content/room.ts'
import { createRenderer, type Renderer } from './renderer.ts'

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
})
