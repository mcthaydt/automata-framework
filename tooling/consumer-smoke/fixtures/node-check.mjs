// consumer-smoke's Node step (M2.4 spec §3.6): import every published entry from the installed packages, as a
// game's build tools and tests would, and run a sim with a small plugin of core verbs (physics is Automata Plus
// since PRODUCT.5g). ui's root is left to the Vite step: it exports Svelte components, which only load through
// the Svelte compiler. So are runtime's `.` and `./testing` (Svelte rune modules), render-pixi, game and the
// umbrella (Svelte components, PixiJS): the game steps build and boot them (DX.2a). runtime's `./extension`,
// which an extension's own Node tests import, loads here.
import * as content from '@mcthaydt/automata-content'
import * as contentLocale from '@mcthaydt/automata-content/locale'
import * as contentVite from '@mcthaydt/automata-content/vite'
import * as host from '@mcthaydt/automata-host'
import * as hostTarget from '@mcthaydt/automata-host/target'
import * as hostTesting from '@mcthaydt/automata-host/testing'
import * as node from '@mcthaydt/automata-node'
import * as runtimeExtension from '@mcthaydt/automata-runtime/extension'
import { createSim, defineComponent, definePlugin, defineSystem } from '@mcthaydt/automata-sim'
import * as hash from '@mcthaydt/automata-sim/hash'
import * as math from '@mcthaydt/automata-sim/math'
import * as testing from '@mcthaydt/automata-testing'
import * as ship from '@mcthaydt/automata-tools'
import * as uiTesting from '@mcthaydt/automata-ui/testing'

const entries = {
  content,
  contentLocale,
  contentVite,
  host,
  hostTarget,
  hostTesting,
  node,
  runtimeExtension,
  ship,
  hash,
  math,
  testing,
  uiTesting,
}
for (const [name, entry] of Object.entries(entries)) {
  if (Object.keys(entry).length === 0) throw new Error(`${name} exports nothing`)
}
if (typeof content.compileContent !== 'function') throw new Error('content.compileContent is missing')
if (typeof contentLocale.createContentText !== 'function')
  throw new Error('content/locale.createContentText is missing')
if (typeof contentVite.automataContent !== 'function')
  throw new Error('content/vite.automataContent is missing')
if (typeof hostTesting.HostingTest !== 'function') throw new Error('host/testing.HostingTest is missing')
if (typeof runtimeExtension.defineExtension !== 'function')
  throw new Error('runtime/extension.defineExtension is missing')

// A body falling under constant gravity, written with the sim's own verbs.
const Fall = defineComponent('fall', { y: 'f32', vy: 'f32' })
const gravity = defineSystem({
  name: 'gravity',
  phase: 'physics',
  run(ctx) {
    for (const entity of ctx.query(Fall)) {
      const fall = { ...entity.get(Fall) }
      fall.vy -= 0.01
      fall.y += fall.vy
      entity.set(Fall, fall)
    }
  },
})
const fallPlugin = definePlugin({ name: 'fall', components: [Fall], systems: [gravity] })

async function fall() {
  const sim = await createSim({ seed: 1, plugins: [fallPlugin] })
  sim.spawn([[Fall, { y: 3, vy: 0 }]])
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
console.log(`node: ${Object.keys(entries).length + 1} entries imported; fall plugin, 60 ticks, hash ${first}`)
