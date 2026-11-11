// The carried lights' step, in `gameplay` before the systems': a toggle, then the burn, then each lit light's pool is added
// to the lights the senses read (`systems.env`). The game writes the rest of that list each step, earlier in the step.
import type { Places } from '@automata/places'
import { sectorsPlaces } from '@automata/sectors/sim'
import { defineSystem, type SystemDef } from '@automata/sim'
import type { CarriedLightDef } from './carried-light'
import { ToggleLight } from './carried-light.command'
import { CarriedLight } from './carried-light.component'
import { LightDry } from './carried-light.event'
import { SystemsEnv } from './systems.resource'

/**
 * With a `def` the pool's radius and the burn are the file's, and the component's own `radius` is not read; without one the
 * pool is the component's radius and the light burns a tick of fuel a tick, as it did before there was a file.
 */
export const carriedLightSystem = (places: Places = sectorsPlaces, def?: CarriedLightDef): SystemDef =>
  defineSystem({
    name: 'systems.carried-light',
    phase: 'gameplay',
    before: ['systems.step'],
    run: (ctx) => {
      const toggled = ctx.commands.of(ToggleLight).length
      const lights = ctx.resource(SystemsEnv).lights
      for (const carrier of ctx.query(CarriedLight)) {
        const light = carrier.get(CarriedLight)
        let { lit, fuelTicks } = light
        for (let i = 0; i < toggled; i++) {
          if (lit) lit = false
          else if (fuelTicks > 0) lit = true
          else ctx.emit(LightDry, {})
        }
        if (lit) {
          fuelTicks -= def?.burn ?? 1
          if (fuelTicks <= 0) {
            fuelTicks = 0
            lit = false
            ctx.emit(LightDry, {})
          }
        }
        if (lit !== light.lit || fuelTicks !== light.fuelTicks) carrier.set(CarriedLight, { lit, fuelTicks })
        const at = lit ? places.at(ctx, carrier.sid) : undefined
        if (at !== undefined) lights.push({ x: at.x, z: at.z, radius: def?.radius ?? light.radius })
      }
    },
  })
