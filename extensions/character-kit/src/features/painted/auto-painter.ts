// A painted figure painted at the density its camera needs. The painter draws one density a cast member; here a figure keeps one
// `Painter` for each density it has been seen at, so a level that comes back is not painted again (each painter's figure keeps its
// own cells by pose, facing and frame, and its lit cells), and the first frame of a cut to a close shot is painted at the close
// shot's density, not at the last shot's and then again. A density not drawn for a while is let go, since a cell at 8 is 4.5 MB.
import { type Cell, type CharacterDef, member } from '../../shared/figures/door.ts'
import { type Density, densityChooser } from './density.ts'
import { Painter, type PaintInput } from './painter.ts'

export interface AutoPainterOptions {
  /** A density to hold whatever the zoom, or `'auto'` (the default): the density the zoom needs, by `densityNeeded`. */
  readonly density?: Density | 'auto' | undefined
  /** The highest density `'auto'` may pick (4 by default: a new cell at 8 costs about four times one at 4); a game may lift it to 8. */
  readonly maxDensity?: Density | undefined
  /**
   * The character a density paints, for a figure that is dressed differently where its texels can hold more: one whose face is a pair
   * of dots at density 1, where a drawn face is a lid line under the fringe, and a drawn face from density 2. The character's own by default.
   */
  readonly defFor?: ((density: Density) => CharacterDef) | undefined
  /** Keep the skin's hue where the room's light darkens it, and never tint it by the room's colour (`PaintedFigureOptions.holdSkinHue`). */
  readonly holdSkinHue?: boolean | undefined
}

/** How long a density may go undrawn before its painter is let go: a shot is over, and the figure is in the room again. */
export const KEEP_SECONDS = 10

interface Entry {
  readonly painter: Painter
  /** The time the figure has walked since this painter was last stepped, less whole cycles: the walk's phase it is owed. */
  owed: number
  drawnAt: number
}

export class AutoPainter {
  private readonly painters = new Map<Density, Entry>()
  private readonly chooser: ReturnType<typeof densityChooser>
  private readonly pinned: Density | undefined
  /** The figure's own clock: the sum of the steps, as a lone figure adds them. */
  private elapsed = 0
  /** The time it has walked in all, less whole cycles, and the seconds a walk's cycle takes. */
  private walked = 0
  private readonly cycle: number

  constructor(
    private readonly def: CharacterDef,
    private readonly options: AutoPainterOptions = {},
  ) {
    this.pinned = options.density === undefined || options.density === 'auto' ? undefined : options.density
    this.chooser = densityChooser(options.maxDensity ?? 4)
    this.cycle = member(def, 1).gait.cycle
  }

  /** The densities that have a painter now, smallest first. */
  get densities(): readonly Density[] {
    return [...this.painters.keys()].sort((a, b) => a - b)
  }

  /** The cell for this frame at the density `zoom` needs (the zoom of a density-1 texel on screen: `zoomOf`). */
  paint(input: PaintInput, zoom: number): Cell {
    const density = this.pinned ?? this.chooser.pick(zoom)
    const before = this.walked
    const moving = input.state.moving
    this.elapsed += input.dt
    if (moving) this.walked = (this.walked + input.dt) % this.cycle
    let entry = this.painters.get(density)
    // A painter new to the figure starts where the figure's walk is, not at the start of a step.
    if (entry === undefined) {
      entry = {
        painter: new Painter(this.options.defFor?.(density) ?? this.def, density, {
          holdSkinHue: this.options.holdSkinHue,
        }),
        owed: before,
        drawnAt: input.t,
      }
      this.painters.set(density, entry)
    }
    const dt = input.dt + entry.owed
    for (const [other, kept] of this.painters) {
      if (other === density) continue
      if (moving) kept.owed = (kept.owed + input.dt) % this.cycle
      if (input.t - kept.drawnAt > KEEP_SECONDS) this.painters.delete(other)
    }
    entry.owed = 0
    entry.drawnAt = input.t
    return entry.painter.paint({ ...input, dt, clock: this.elapsed })
  }
}
