// The stick mapper's sweep (D3-i): every 64th heading of a turn against a grid of stick vectors, as one hash. Node
// and each browser engine compute it and must get `STICK_SWEEP_HASH`; a different hash is a determinism bug in the
// mapper or in `dmath`, never a golden to update per engine.
import { hex64, xxhash64 } from '@mcthaydt/automata-sim/hash'
import { TURN_UNITS } from '../sim/heading.js'
import { mapStick } from '../sim/stick-mapper.js'

const AXIS = [-127, -90, -64, -1, 0, 1, 64, 90, 127] as const

/** The sweep's `{ x, z }` outputs, in order: heading, then stick y, then stick x. */
export function stickSweep(): Int32Array {
  const out = new Int32Array((TURN_UNITS / 64) * AXIS.length * AXIS.length * 2)
  let i = 0
  for (let heading = 0; heading < TURN_UNITS; heading += 64)
    for (const y of AXIS)
      for (const x of AXIS) {
        const direction = mapStick({ x, y }, heading)
        out[i++] = direction.x
        out[i++] = direction.z
      }
  return out
}

/** The sweep's XXH64, 16 hex digits. */
export const stickSweepHash = (): string => hex64(xxhash64(new Uint8Array(stickSweep().buffer)))

/** What `stickSweepHash()` gives in Node, Chromium, WebKit and Firefox. */
export const STICK_SWEEP_HASH = '18d8cbc553b6c30d'
