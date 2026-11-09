// Core's library: the swatches (the photo-cut materials and patterns), the prop presets and the purpose kits, laid over
// the base library (the base scenes' swatches and presets) so every name a kit uses is in it. A kit's swatch of a base
// name replaces the base's flat one with the textured one (same ramp, same step); a game lays its own over the result
// (`{ ...coreLibrary.swatches, ...own.swatches }`). Loading it registers the kit's prop generators, since a preset can
// name one only once it is registered.
import kits from '../library/kits.json' with { type: 'json' }
import props from '../library/props.json' with { type: 'json' }
import swatches from '../library/swatches.json' with { type: 'json' }
import '../props/kit/register-kit-props.ts'
import type { WorldLibrary } from '../swatches.ts'
import { baseLibrary } from './base-library.ts'

export const coreLibrary: WorldLibrary = {
  swatches: { ...baseLibrary.swatches, ...swatches },
  props: { ...baseLibrary.props, ...props },
  kits,
}
