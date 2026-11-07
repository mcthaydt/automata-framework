// `in-sector`: a walker's place on the floor plan and the sector it stands in. The game writes `x` and `z` (its own
// position component's plan coordinates) and sectors decides `sector` on the fixed step (S4-D6).
import { type ComponentDef, defineComponent } from '@mcthaydt/automata-sim'

const inSectorFields = {
  /** Plan position in metres, written by the game. */
  x: 'f64',
  z: 'f64',
  /** The sector it stands in, as its index in the map plus one; 0 outside every sector. Written by sectors. */
  sector: 'u32',
} as const

export const InSector: ComponentDef<typeof inSectorFields> = defineComponent(
  'sectors.in-sector',
  inSectorFields,
)
