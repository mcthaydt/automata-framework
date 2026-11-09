import { createSim, defineComponent, definePlugin } from '@automata/sim'
import { Container } from 'pixi.js'
import { expect, it } from 'vitest'
import { RenderDeltaConsumer } from '#src/features/render/delta/render-delta-consumer.ts'
import { rect } from '#src/features/render/views/rect-view.ts'

const Body = defineComponent('body', { x: 'f32', y: 'f32' })
const bodies = definePlugin({ name: 'bodies', components: [Body] })

it('rebuilds rect views from the snapshot after a restore (full resync)', async () => {
  const sim = await createSim({ seed: 1, plugins: [bodies] })
  const world = new Container()
  const consumer = new RenderDeltaConsumer(world, { [Body.id]: rect({ w: 8, h: 8, color: 0xf9c22b }) })

  const sid = sim.spawn([[Body, { x: 1, y: 2 }]])
  consumer.apply(sim.step([]).render)
  const saved = sim.snapshot()
  const before = world.children[0]

  sim.entity(sid)?.set(Body, { x: 9 })
  consumer.apply(sim.step([]).render)
  expect(world.children[0]?.x).toBe(9)

  sim.restore(saved)
  const resync = sim.step([]).render
  expect(resync.resync).toBe(true)
  consumer.apply(resync)

  expect(world.children).toHaveLength(1)
  expect(world.children[0]).not.toBe(before)
  expect([world.children[0]?.x, world.children[0]?.y]).toEqual([1, 2])
  sim.dispose()
})
