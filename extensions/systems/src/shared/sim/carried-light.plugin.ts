// The carried-light plugin, opt-in, as the peek is: a plugin of its own beside `systems`, so a sim without it keeps the
// snapshot header it always had.
import type { Places } from '@automata/places'
import { sectorsPlaces } from '@automata/sectors/sim'
import { definePlugin, type PluginDef } from '@automata/sim'
import { ToggleLight } from './carried-light.command'
import { CarriedLight } from './carried-light.component'
import { LightDry } from './carried-light.event'
import { carriedLightSystem } from './carried-light.system'

/** Carried lights for a game: a component on the carrier, a toggle command, the burn, and the pool in `env.lights`. */
export function createCarriedLight(options: { readonly places?: Places } = {}): PluginDef {
  const places = options.places ?? sectorsPlaces
  return definePlugin({
    name: 'carried-light',
    dependsOn: ['systems', places.provider],
    components: [CarriedLight],
    commands: [ToggleLight],
    events: [LightDry],
    systems: [carriedLightSystem(places)],
  })
}
