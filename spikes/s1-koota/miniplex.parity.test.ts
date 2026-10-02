// The S1 fallback, measured with the same order-dependent tick, so ADR 0001 compares two tested options.
import { World } from 'miniplex'
import { expect, test } from 'vitest'
import { f64Bytes, sha256Hex } from '../shared/hash'
import { nextRand } from '../shared/prng'
import { MINIPLEX_EXPECTED } from './expected'

type E = {
  sid: number
  pos: { x: number; y: number }
  vel: { x: number; y: number }
  hp?: number
  contains?: Array<[number, number]> // Miniplex has no relations: [target sid, amount]
}
type MSim = { world: World<E>; nextId: number; acc: number; rng: { s: number } }
type Order = 'native' | 'sorted'

const create = (seed: number): MSim => ({ world: new World<E>(), nextId: 1, acc: 0, rng: { s: seed >>> 0 } })
const r = (sim: MSim) => nextRand(sim.rng)

function spawn(sim: MSim): E {
  const e: E = {
    sid: sim.nextId++,
    pos: { x: Math.fround(r(sim) * 100), y: Math.fround(r(sim) * 100) },
    vel: { x: Math.fround(r(sim) - 0.5), y: Math.fround(r(sim) - 0.5) },
  }
  if (r(sim) < 0.35) e.hp = Math.floor(r(sim) * 100)
  return sim.world.add(e)
}

const live = (sim: MSim, order: Order): E[] => {
  const list = [...sim.world.with('sid')]
  return order === 'sorted' ? list.sort((a, b) => a.sid - b.sid) : list
}

function tick(sim: MSim, order: Order, dt = 1 / 60): void {
  for (const e of sim.world.with('pos', 'vel')) {
    e.pos.x = Math.fround(e.pos.x + e.vel.x * dt)
    e.pos.y = Math.fround(e.pos.y + e.vel.y * dt)
  }
  const list = live(sim, order)
  for (const e of list) sim.acc = (Math.imul(sim.acc, 31) + e.sid) >>> 0
  const pick = () => list[Math.floor(r(sim) * list.length)]
  const victim = pick()
  if (victim) sim.world.remove(victim)
  spawn(sim)
  spawn(sim)
  const toggled = pick()
  if (toggled && sim.world.has(toggled)) {
    if (toggled.hp !== undefined) sim.world.removeComponent(toggled, 'hp')
    else sim.world.addComponent(toggled, 'hp', Math.floor(r(sim) * 100))
  }
  const a = pick()
  const b = pick()
  if (a && b && a !== b && sim.world.has(a) && sim.world.has(b)) {
    a.contains = [...(a.contains ?? []), [b.sid, Math.floor(r(sim) * 10)]]
  }
}

const stateRows = (sim: MSim): number[] => {
  const rows: number[] = [sim.nextId, sim.acc, sim.rng.s]
  for (const e of live(sim, 'sorted'))
    rows.push(e.sid, e.pos.x, e.pos.y, e.vel.x, e.vel.y, e.hp ?? -1, ...(e.contains ?? []).flat())
  return rows
}

function snapshotRestore(sim: MSim): MSim {
  const json = JSON.stringify({
    nextId: sim.nextId,
    acc: sim.acc,
    rng: sim.rng.s,
    entities: live(sim, 'sorted'),
  })
  const data = JSON.parse(json) as { nextId: number; acc: number; rng: number; entities: E[] }
  const out = create(data.rng)
  out.nextId = data.nextId
  out.acc = data.acc
  for (const e of data.entities) out.world.add(e)
  return out
}

async function run(order: Order, restoreAt?: number): Promise<string> {
  let sim = create(99)
  for (let i = 0; i < 3_000; i++) spawn(sim)
  for (let t = 0; t < 300; t++) {
    if (t === restoreAt) sim = snapshotRestore(sim)
    tick(sim, order)
  }
  expect(sim.world.with('sid').size).toBeGreaterThan(3_000)
  return sha256Hex(f64Bytes(stateRows(sim)))
}

test('Miniplex: sorted iteration survives snapshot/restore and is identical in every engine', async () => {
  const straight = await run('sorted')
  expect(await run('sorted', 150)).toBe(straight)
  expect(straight).toBe(MINIPLEX_EXPECTED)
})

test('Miniplex: native iteration across restore (informational)', async () => {
  console.log(
    `[S1] miniplex native-order-survives-restore=${(await run('native')) === (await run('native', 150))}`,
  )
})
