// consumer-smoke's Node step (M2.4 spec §3.6): import every published entry from the installed packages, as a
// game's build tools and tests would, and run a sim with physics.
import * as content from '@mcthaydt/automata-content'
import * as contentVite from '@mcthaydt/automata-content/vite'
import * as host from '@mcthaydt/automata-host'
import * as hostTesting from '@mcthaydt/automata-host/testing'
import * as node from '@mcthaydt/automata-node'
import { BodyKind, body2d, collider2d, physics2d, transform2d } from '@mcthaydt/automata-physics/2d'
import * as physics3d from '@mcthaydt/automata-physics/3d'
import * as ship from '@mcthaydt/automata-ship'
import { createSim } from '@mcthaydt/automata-sim'
import * as hash from '@mcthaydt/automata-sim/hash'
import * as math from '@mcthaydt/automata-sim/math'
import * as testing from '@mcthaydt/automata-testing'

const entries = { content, contentVite, host, hostTesting, node, physics3d, ship, hash, math, testing }
for (const [name, entry] of Object.entries(entries)) {
  if (Object.keys(entry).length === 0) throw new Error(`${name} exports nothing`)
}
if (typeof content.compileContent !== 'function') throw new Error('content.compileContent is missing')
if (typeof contentVite.automataContent !== 'function')
  throw new Error('content/vite.automataContent is missing')
if (typeof hostTesting.HostingTest !== 'function') throw new Error('host/testing.HostingTest is missing')

async function fall() {
  const sim = await createSim({ seed: 1, plugins: [physics2d()] })
  sim.spawn([transform2d({ y: 3 }), body2d(BodyKind.dynamic), collider2d.ball(0.5)])
  for (let tick = 0; tick < 60; tick++) sim.step([])
  const result = sim.hash()
  sim.dispose()
  return result
}
const first = await fall()
const second = await fall()
if (!/^[0-9a-f]{16}$/.test(first) || first !== second)
  throw new Error(`sim hashes differ: ${first} ${second}`)
// The .replay round trip (packReplay/unpackReplay) joins this step when M2.3 publishes `./replay`.
console.log(
  `node: ${Object.keys(entries).length + 2} entries imported; physics2d sim, 60 ticks, hash ${first}`,
)
