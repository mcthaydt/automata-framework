// The particles of a scene at a time, as sprites to lay on the frame: where each is (world metres), its colour and its radius.
// A port of the source look's emitters: steam rising from a vent in puffs that thin as they rise, drips
// falling off an edge, a carried flame's core and tongue, moths circling a lamp. The motion steps twelve times a second. The
// pass (particles-effect.ts) lays the sprites on the frame, depth-tested.

/** Where particles come from: steam (a vent, a manhole), drips (along an edge from `at` to `to`, falling to `ground`), a flame, moths. */
export type Emitter =
  | { readonly kind: 'steam' | 'flame' | 'moth'; readonly at: readonly [number, number, number] }
  | {
      readonly kind: 'drip'
      readonly at: readonly [number, number, number]
      readonly to: readonly [number, number, number]
      readonly ground?: number | undefined
    }

/** One particle: a world place, a colour (`0xRRGGBB`) and a radius (0: a single pixel; the pass scales the rest). */
export interface Sprite {
  readonly at: readonly [number, number, number]
  readonly colour: number
  readonly radius: number
}

/** A hash of three integers to [0, 1). */
function hash(a: number, b: number, c: number): number {
  let n = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}

/** The sprites of `emitters` at `t` seconds. */
export function particleSprites(emitters: readonly Emitter[], t: number): Sprite[] {
  const tk = Math.floor(t * 12) / 12
  const out: Sprite[] = []
  emitters.forEach((e, ei) => {
    const [x, y, z] = e.at
    if (e.kind === 'steam')
      for (let i = 0; i < 7; i++) {
        // Puffs rising and spreading over two seconds, lighter low, broken (every other one) as they thin.
        const ph = (tk * 0.5 + i / 7 + ei * 0.13) % 1
        if (ph > 0.7 && (i + Math.floor(tk * 12)) % 2) continue
        out.push({
          at: [x + Math.sin(ph * 5 + i) * 0.12 * ph, y + ph * 1.6, z + Math.cos(ph * 4 + i) * 0.08],
          colour: ph < 0.45 ? 0xcdd2da : 0x848795,
          radius: 0.6 + ph * 1.6,
        })
      }
    if (e.kind === 'drip')
      for (let i = 0; i < 6; i++) {
        // Drops fall off the edge to the ground in half a second, each from its own place along it.
        const u = hash(i, ei, 5)
        const ph = (tk * 2 + hash(i, ei, 9)) % 1
        const ground = e.ground ?? 0
        const at = [x + (e.to[0] - x) * u, y - (y - ground) * ph * ph, z + (e.to[2] - z) * u] as const
        out.push(
          { at, colour: 0x88d6ff, radius: 0 },
          { at: [at[0], at[1] + 0.06, at[2]], colour: 0x88d6ff, radius: 0 },
        )
      }
    if (e.kind === 'flame') {
      // A hot core over a flickering orange tongue, a pixel's lick up now and then.
      const lick = hash(ei, Math.floor(tk * 12), 3)
      out.push(
        { at: [x, y + 0.02, z], colour: 0xf99b4e, radius: 1.2 },
        { at: [x, y + 0.06 + (lick > 0.5 ? 0.03 : 0), z], colour: 0xffbc4e, radius: 0.8 },
        { at: [x, y + 0.05, z], colour: 0xffe949, radius: 0.4 },
      )
    }
    if (e.kind === 'moth')
      for (let i = 0; i < 3; i++) {
        // Moths circling the lamp, erratic, dark against its glow.
        const a = tk * (3 + i) + i * 2.1
        const r = 0.25 + 0.15 * Math.sin(tk * 7 + i * 3)
        out.push({
          at: [x + Math.cos(a) * r, y - 0.15 + Math.sin(tk * 5 + i) * 0.15, z + Math.sin(a) * r],
          colour: 0x3c3151,
          radius: 0,
        })
      }
  })
  return out
}
