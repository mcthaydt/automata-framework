// A ward's fittings and its folding screen: a wash basin, an extinguisher in its cabinet, a strip light, a coat on its hooks
// and a privacy screen. Each faces +z with its origin at the centre of its base on y = 0 (a wall fitting is placed at the
// height it hangs at), at about the size of the source game's model, so a `fit` to that box barely stretches the shape.
import { box, type Generator, merge, part, rbox, rod } from '@automata/3d/props-kit'

/** A wash basin on the wall: a splash plate behind a bowl, a tap over it and the waste pipe down to the floor. */
const sink: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.51, 0.8, 0.45]
  const rim = h * 0.4
  return {
    pieces: [
      part(box([0, rim, -d / 2 + 0.01], [w, h - rim, 0.02]), p.splash ?? 'chrome', 'splash'),
      part(rbox([0, rim, 0.0], [w, 0.14, d - 0.04], 0.5), p.bowl ?? 'potWhite', 'bowl'),
      part(
        merge(
          rod([0, rim + 0.14, -d * 0.28], [0, h * 0.7, -d * 0.28], 0.014, 8),
          rod([0, h * 0.7, -d * 0.28], [0, h * 0.7, -d * 0.12], 0.012, 8),
        ),
        p.tap ?? 'chrome',
        'tap',
      ),
      part(rod([0, 0, -d * 0.3], [0, rim, -d * 0.3], 0.02, 6), p.pipe ?? 'pipeSteel', 'pipe'),
    ],
  }
}

/** An extinguisher cabinet: a red box with a glazed front and a handle. */
const extinguisherCabinet: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.42, 0.75, 0.17]
  return {
    pieces: [
      part(rbox([0, 0, 0], [w, h, d], 0.1), p.mat ?? 'doorRed', 'body'),
      part(box([0, h * 0.13, d / 2 + 0.002], [w * 0.78, h * 0.74, 0.004]), p.glass ?? 'carGlass', 'glass', {
        noCast: true,
      }),
      part(
        rod([w * 0.3, h * 0.1, d / 2 + 0.01], [w * 0.3, h * 0.28, d / 2 + 0.01], 0.008, 6),
        p.handle ?? 'chrome',
        'handle',
      ),
    ],
  }
}

/** A strip light: a steel housing with the tube slung under it, lit; a ceiling fitting is placed at the height it hangs at. */
const stripLight: Generator = (p) => {
  const [l, h, w] = p.size ?? [1.25, 0.1, 0.3]
  return {
    pieces: [
      part(box([0, h * 0.4, 0], [l, h * 0.6, w]), p.housing ?? 'metalSheet', 'housing'),
      part(box([0, 0, 0], [l - 0.1, h * 0.4, w * 0.6]), p.tube ?? 'bulbCool', 'tube', { noCast: true }),
    ],
  }
}

/** A coat on a hook board: a plank on the wall with three brass hooks and a coat hanging from the middle one. */
const coatHooks: Generator = (p) => {
  const [w, h, d] = p.size ?? [0.51, 1.15, 0.24]
  const board = h - 0.12
  return {
    pieces: [
      part(box([0, board, -d / 2], [w, 0.12, 0.03]), p.board ?? 'oak', 'board'),
      part(
        merge(
          ...([-1, 0, 1] as const).map((k) =>
            rod([k * w * 0.36, board + 0.06, -d / 2 + 0.03], [k * w * 0.36, board + 0.07, d / 2], 0.012, 6),
          ),
        ),
        p.hook ?? 'brass',
        'hooks',
      ),
      part(
        rbox([0, 0, -d / 2 + 0.06], [w * 0.62, board - 0.02, d * 0.55], 0.5),
        p.coat ?? 'fabricKnit',
        'coat',
      ),
    ],
  }
}

/** A four-panel folding screen: the panels zigzag, each with a cloth face, on a steel foot rail and top rails. */
const privacyScreen: Generator = (p) => {
  const [w, h, d] = p.size ?? [1.25, 1.6, 0.45]
  const count = 4
  const panel = w / count
  const swing = d / 2
  // Panel k stands at x, a step each side of the middle, and alternates fore and aft: the pattern is the same turned half a turn.
  const at = Array.from({ length: count }, (_, k): [number, number] => [
    (k - (count - 1) / 2) * panel,
    k % 2 === 0 ? -swing : swing,
  ])
  const first = at[0] as [number, number]
  const last = at[count - 1] as [number, number]
  return {
    pieces: [
      part(
        merge(...at.map(([x, z]) => rbox([x, 0, z], [panel - 0.03, h, 0.03], 0.2))),
        p.cloth ?? 'curtainClinic',
        'panels',
      ),
      part(
        merge(
          rod([first[0] - panel / 2, 0.012, first[1]], [last[0] + panel / 2, 0.012, last[1]], 0.012, 6),
          ...at.map(([x, z]) => rod([x - panel / 2, h, z], [x + panel / 2, h, z], 0.01, 6)),
        ),
        p.frame ?? 'chrome',
        'frame',
      ),
    ],
  }
}

export const WARD_FITTINGS: Readonly<Record<string, Generator>> = {
  sink,
  extinguisherCabinet,
  stripLight,
  coatHooks,
  privacyScreen,
}
