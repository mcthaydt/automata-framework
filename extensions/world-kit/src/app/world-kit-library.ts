// The library the kit brings: the swatches (the photo-cut materials and patterns), the prop presets and the purpose kits,
// laid over core's base library (the base scenes' swatches and presets) so every name a kit uses is in it. The kit's
// swatch of a base name replaces core's flat one with the textured one (same ramp, same step); a game lays its own over
// the result (`{ ...worldKitLibrary.swatches, ...own.swatches }`).
import { baseLibrary } from '@automata/3d/base'
import type { WorldLibrary } from '@automata/3d/props-kit'
import kits from '../../library/kits.json' with { type: 'json' }
import props from '../../library/props.json' with { type: 'json' }
import swatches from '../../library/swatches.json' with { type: 'json' }

export const worldKitLibrary: WorldLibrary = {
  swatches: { ...baseLibrary.swatches, ...swatches },
  props: { ...baseLibrary.props, ...props },
  kits,
}
