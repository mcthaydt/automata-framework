import { DEFAULT_HEAD, DEFAULT_SLIDERS } from '@mcthaydt/automata-figures'

// The sliders the Studio's Look shows (EDS.9a; editor suite spec §6.2, EDS-D16): the figure's body sliders and the
// face's fourteen in five folded groups, with the bounds the figures schema holds and the defaults the figure builds
// from when a slider is not written. A figure's `sliders` table and `sliders.face` are the places they are written.

export interface SliderField {
  readonly id: string
  readonly label: string
  /** Where it is written under `sliders`. */
  readonly path: readonly string[]
  readonly min: number
  readonly max: number
  readonly step: number
  readonly default: number
  readonly unit?: string
}

/** Every body slider but the face's, in the order a person reads a body. */
const BODY: readonly (readonly [string, string, number, number, number, string?])[] = [
  ['height', 'Height', 120, 240, 1, 'cm'],
  ['frame', 'Frame', -0.25, 1.25, 0.05],
  ['muscle', 'Muscle', -0.25, 1.25, 0.05],
  ['fat', 'Fat', -0.25, 1.25, 0.05],
  ['shoulders', 'Shoulders', -0.25, 1.25, 0.05],
  ['hips', 'Hips', -0.25, 1.25, 0.05],
  ['legs', 'Legs', -0.25, 1.25, 0.05],
  ['arms', 'Arms', -0.25, 1.25, 0.05],
  ['head', 'Head', -0.25, 1.25, 0.05],
  ['neck', 'Neck', -0.25, 1.25, 0.05],
  ['neckLength', 'Neck length', -0.25, 1.25, 0.05],
  ['hands', 'Hands', -0.25, 1.25, 0.05],
  ['feet', 'Feet', -0.25, 1.25, 0.05],
  ['posture', 'Posture', -0.25, 1.25, 0.05],
  ['age', 'Age', -0.25, 1.25, 0.05],
  ['headTilt', 'Head tilt', -30, 30, 1, '°'],
  ['chunk', 'Chunk', -0.25, 1.25, 0.05],
  ['faceForward', 'Face forward', -0.25, 1.25, 0.05],
  ['hunch', 'Hunch', -0.25, 1.25, 0.05],
]

const defaultOf = (id: string): number => (DEFAULT_SLIDERS as unknown as Record<string, number>)[id] ?? 0.5

export const BODY_SLIDERS: readonly SliderField[] = BODY.map(([id, label, min, max, step, unit]) => ({
  id,
  label,
  path: [id],
  min,
  max,
  step,
  default: defaultOf(id),
  ...(unit === undefined ? {} : { unit }),
}))

export interface FaceGroup {
  readonly id: string
  readonly label: string
  readonly sliders: readonly SliderField[]
}

const face = (ids: readonly (readonly [string, string])[]): readonly SliderField[] =>
  ids.map(([id, label]) => ({
    id,
    label,
    path: ['face', id],
    min: -0.25,
    max: 1.25,
    step: 0.05,
    default: (DEFAULT_HEAD as unknown as Record<string, number>)[id] ?? 0.5,
  }))

/** The face's fourteen sliders as FigureBuilder groups them. */
export const FACE_GROUPS: readonly FaceGroup[] = [
  {
    id: 'structure',
    label: 'Structure',
    sliders: face([
      ['width', 'Width'],
      ['jaw', 'Jaw'],
      ['chin', 'Chin'],
    ]),
  },
  {
    id: 'cheeks',
    label: 'Cheeks',
    sliders: face([
      ['cheekHeight', 'Cheek height'],
      ['cheekWidth', 'Cheek width'],
    ]),
  },
  {
    id: 'nose-lips',
    label: 'Nose and lips',
    sliders: face([
      ['bridge', 'Bridge'],
      ['nose', 'Nose'],
      ['lips', 'Lips'],
    ]),
  },
  {
    id: 'brows',
    label: 'Brows',
    sliders: face([
      ['browArch', 'Brow arch'],
      ['browWeight', 'Brow weight'],
      ['browHeight', 'Brow height'],
    ]),
  },
  {
    id: 'lids',
    label: 'Lids',
    sliders: face([
      ['crease', 'Crease'],
      ['hood', 'Hood'],
      ['liner', 'Liner'],
    ]),
  },
]

/** A slider's value in a figure's `sliders`, or its default when the figure does not write it. */
export function sliderValue(sliders: Readonly<Record<string, unknown>>, field: SliderField): number {
  let node: unknown = sliders
  for (const key of field.path) node = (node as Readonly<Record<string, unknown>> | undefined)?.[key]
  return typeof node === 'number' ? node : field.default
}
