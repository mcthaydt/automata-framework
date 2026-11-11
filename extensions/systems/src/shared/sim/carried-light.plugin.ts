// The carried-light plugin, opt-in, as the peek is: a plugin of its own beside `systems`, so a sim without it keeps the
// snapshot header it always had.
import type { Places } from '@automata/places'
import { sectorsPlaces } from '@automata/sectors/sim'
import { definePlugin, type PluginDef } from '@automata/sim'
import { type CarriedLightDef, carriedLightDefOf } from './carried-light'
import { ToggleLight } from './carried-light.command'
import { CarriedLight } from './carried-light.component'
import { LightDry } from './carried-light.event'
import { carriedLightSystem } from './carried-light.system'

export interface CarriedLightOptions {
  readonly places?: Places
  /**
   * The light's numbers (`carriedLightDefOf(file)`, from `content/carried-light.toml`): the pool's radius and the burn. A bad
   * number throws, in words, here.
   */
  readonly def?: CarriedLightDef
}

/** Carried lights for a game: a component on the carrier, a toggle command, the burn, and the pool in `env.lights`. */
export function createCarriedLight(options: CarriedLightOptions = {}): PluginDef {
  const places = options.places ?? sectorsPlaces
  const def = options.def === undefined ? undefined : carriedLightDefOf(options.def)
  return definePlugin({
    name: 'carried-light',
    dependsOn: ['systems', places.provider],
    components: [CarriedLight],
    commands: [ToggleLight],
    events: [LightDry],
    systems: [carriedLightSystem(places, def)],
  })
}
