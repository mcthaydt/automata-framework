import { PuzzleState } from '@automata/puzzle/sim'
import { defineSystem, type SystemDef } from '@automata/sim'
import { CarriedLight, type CarriedLightDef, fuelTicksOf, SystemsEnv } from '@automata/systems/sim'
import { Ada } from '../../shared/ada.component.ts'
import { TICK_HZ } from '../../shared/constants.ts'
import { playIn } from '../../shared/play-content.ts'

/** The item that is the lamp. */
export const LAMP_ITEM = 'handLamp'

/**
 * Ada has a light to switch only once she holds the lamp: until then F does nothing (and says nothing), so the lamp's
 * "dry" line is never spoken before there is a lamp. The light is added to her the tick she picks it up, unlit, with the
 * fuel the file starts it with.
 */
export const lampGate = (def: CarriedLightDef): SystemDef =>
  defineSystem({
    name: 'lamp.gate',
    phase: 'gameplay',
    before: ['systems.carried-light'],
    run: (ctx) => {
      if (!ctx.resource(PuzzleState).items.includes(LAMP_ITEM)) return
      for (const ada of ctx.query(Ada))
        if (!ada.has(CarriedLight))
          ada.add(CarriedLight, {
            lit: false,
            fuelTicks: fuelTicksOf(def.start, TICK_HZ),
            radius: def.radius,
          })
    },
  })

/** The room's lamps that light the creature's way until lights out: the desk, the hall, the ward and the exit. */
export const LIT_UNTIL_LIGHTS_OUT: ReadonlySet<string> = new Set([
  'deskLamp',
  'hallLamp',
  'wardLamp',
  'exitLamp',
])

/**
 * The lights the creature's senses read, written fresh each step before the carried light adds Ada's pool: the room's four
 * lamps until the lights go (the corridor's and the supply room's bulbs have gone, which is the dark Ada's lamp lights),
 * and nothing after. The list would otherwise grow by one pool every tick.
 */
export const lampLights: SystemDef = defineSystem({
  name: 'lamp.lights',
  phase: 'gameplay',
  before: ['systems.carried-light'],
  run: (ctx) => {
    const lights = ctx.resource(SystemsEnv).lights
    lights.length = 0
    if (ctx.resource(PuzzleState).facts.lightsOut === true) return
    for (const pool of playIn(ctx.content).pools)
      if (LIT_UNTIL_LIGHTS_OUT.has(pool.id)) lights.push({ x: pool.x, z: pool.z, radius: pool.radius })
  },
})
