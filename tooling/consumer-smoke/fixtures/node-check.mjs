// consumer-smoke's Node step: import every published entry that loads in plain Node, as a game's build tools and tests
// would, and run a sim with a small plugin of core verbs. `@automata/framework`'s root, `./testing` and `./tooling`
// export Svelte components and a stylesheet, which only load through the Svelte compiler: the game steps build and boot
// them. `./extension`, which an extension's own Node tests import, and `./target` load here.
import * as automataExtension from '@automata/framework/extension'
import '@automata/framework/no-eval'
import * as content from '@automata/content'
import * as contentLocale from '@automata/content/locale'
import * as contentPalette from '@automata/content/palette'
import * as contentSchema from '@automata/content/schema'
import * as contentVite from '@automata/content/vite'
import * as automataTarget from '@automata/framework/target'
import { createSim, defineComponent, definePlugin, defineSystem } from '@automata/sim'
import * as hash from '@automata/sim/hash'
import * as math from '@automata/sim/math'
import * as tools from '@automata/tools'

const entries = {
  automataExtension,
  automataTarget,
  content,
  contentLocale,
  contentPalette,
  contentSchema,
  contentVite,
  tools,
  hash,
  math,
}
for (const [name, entry] of Object.entries(entries)) {
  if (Object.keys(entry).length === 0) throw new Error(`${name} exports nothing`)
}
if (typeof content.compileContent !== 'function') throw new Error('content.compileContent is missing')
if (typeof contentLocale.createContentText !== 'function')
  throw new Error('content/locale.createContentText is missing')
if (typeof contentVite.automataContent !== 'function')
  throw new Error('content/vite.automataContent is missing')
if (typeof contentSchema.defineContentSchema !== 'function')
  throw new Error('content/schema.defineContentSchema is missing')
if (typeof contentPalette.DEFAULT_PALETTE !== 'object')
  throw new Error('content/palette.DEFAULT_PALETTE is missing')
if (typeof automataExtension.defineExtension !== 'function')
  throw new Error('automata/extension.defineExtension is missing')
if (typeof automataTarget.createHosting !== 'function')
  throw new Error('automata/target.createHosting is missing')

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

if (typeof tools.defineShipConfig !== 'function') throw new Error('tools.defineShipConfig is missing')

console.log(`node: ${Object.keys(entries).length + 1} entries imported; fall plugin, 60 ticks, hash ${first}`)
