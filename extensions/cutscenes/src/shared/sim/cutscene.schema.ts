// A cutscene script as data. The original's scripts were
// functions of a context; these are rows. An actor row's position is a point, or an anchor name (`player`, `actor:<who>`,
// or a hotspot or nav node the game names) resolved when the cutscene starts. A caption names a line key; its text is the
// locale's. The original's one-off marks (`powerAt`, `exitOpenAt`, `flatline`) are `states` rows here.
//
// Every keyed row is a key on the one timeline (`@automata/3d/timeline`), and an `ease` is that timeline's. A key with
// no ease is eased `smooth`, which is the cutscene default (a figure's clip, which the timeline also keys, is linear);
// a camera key with `cut` arrives with no easing at all.
import { type Ease, easeSchema } from '@automata/3d/timeline'
import { z } from 'zod'

export type V3 = readonly [number, number, number]

/** `lens`: focal length in mm for this key (default the script's), eased with the move. `cut`: arrive without easing. */
export interface CameraKey {
  readonly t: number
  readonly pos: V3
  readonly look: V3
  readonly cut?: boolean | undefined
  readonly lens?: number | undefined
  readonly ease?: Ease | undefined
}
/**
 * One row of an actor's path. `at` is an anchor, or `x` and `z` a plan point. `through`: the key may cross a solid (a door
 * opening). `pose` and `frame`: a clip of the figure's, played from this key until a key without one (`frame` holds one
 * frame). `y`: metres above the floor; `shiver`: a sideways tremble in metres. `density` and `face`: close-up detail.
 */
export interface ActorKey {
  readonly who: string
  readonly t: number
  readonly at?: string | undefined
  readonly x?: number | undefined
  readonly z?: number | undefined
  readonly alpha?: number | undefined
  readonly facing?: number | undefined
  readonly moving?: boolean | undefined
  readonly cut?: boolean | undefined
  readonly through?: boolean | undefined
  readonly pose?: string | undefined
  readonly frame?: number | undefined
  readonly y?: number | undefined
  readonly shiver?: number | undefined
  readonly density?: number | undefined
  readonly face?: string | undefined
}
export interface Caption {
  readonly t: number
  readonly until: number
  /** The line record's id; its text is the locale's. */
  readonly line: string
  readonly speaker?: string | undefined
}
export interface LightKey {
  readonly t: number
  readonly lamp: string
  readonly level: number
}
export interface SoundKey {
  readonly t: number
  readonly kind: string
}
/** How far the door of room `door` stands open from `t` on: 0 shut … 1 open. */
export interface DoorKey {
  readonly t: number
  readonly door: string
  readonly open: number
  readonly ease?: Ease | undefined
}
/** The time of day (a `TimeOfDay` name) the scene is lit by from `t` on. */
export interface TimeKey {
  readonly t: number
  readonly time: string
}
/** The mood grade (a level's `look.grade` name) the scene is graded with from `t` on. */
export interface GradeKey {
  readonly t: number
  readonly grade: string
}
/**
 * A prop's whole state at `t` (see `PropState`): where it stands, how far it is turned, whether it has gone. A field
 * a key leaves out is the prop as it was placed, and between two keys a field moves only when both name it.
 */
export interface PropKey {
  readonly t: number
  readonly prop: string
  readonly at?: V3 | undefined
  readonly turn?: number | undefined
  readonly hidden?: boolean | undefined
  readonly ease?: Ease | undefined
}
/** At `at` seconds the figure `who` starts the clip `clip`. */
export interface CueKey {
  readonly at: number
  readonly who: string
  readonly clip: string
}
export interface CutsceneScript {
  readonly id: string
  /** Seconds. */
  readonly duration: number
  /** The focal length (mm) of a camera key that names none; the play lens, 50 mm, when unset. */
  readonly lens?: number | undefined
  readonly camera: readonly CameraKey[]
  readonly actor?: readonly ActorKey[] | undefined
  readonly caption?: readonly Caption[] | undefined
  readonly light?: readonly LightKey[] | undefined
  readonly sound?: readonly SoundKey[] | undefined
  readonly doors?: readonly DoorKey[] | undefined
  readonly time?: readonly TimeKey[] | undefined
  readonly grade?: readonly GradeKey[] | undefined
  readonly props?: readonly PropKey[] | undefined
  /** Clips the scene starts on figures, each once as the scene passes its time. */
  readonly cues?: readonly CueKey[] | undefined
  /** Camera shake windows: [from, to, metres], strongest at `from` and dying out by `to`. */
  readonly shake?: readonly (readonly [number, number, number])[] | undefined
  /** Lamp flicker windows: [from, to]. */
  readonly flicker?: readonly (readonly [number, number])[] | undefined
  /** Fades to black: 0 clear, 1 black. */
  readonly fade?: readonly { readonly t: number; readonly value: number }[] | undefined
  /** Prop states the scene shows from `t` on (`cabinet.open`): the script drives what its lines say. */
  readonly states?: readonly { readonly t: number; readonly state: string }[] | undefined
  /** The game is won when this cutscene ends. */
  readonly victory?: boolean | undefined
  /** Lint rules this script may break, each with the reason; `context` limits it to sample contexts whose name contains it. */
  readonly lintAllow?:
    | readonly { readonly rule: string; readonly reason: string; readonly context?: string | undefined }[]
    | undefined
}

const v3 = z.tuple([z.number(), z.number(), z.number()])
const cameraKey: z.ZodType<CameraKey> = z.strictObject({
  t: z.number(),
  pos: v3,
  look: v3,
  cut: z.boolean().optional(),
  lens: z.number().positive().optional(),
  ease: easeSchema.optional(),
})
const actorKey: z.ZodType<ActorKey> = z.strictObject({
  who: z.string().min(1),
  t: z.number(),
  at: z.string().min(1).optional(),
  x: z.number().optional(),
  z: z.number().optional(),
  alpha: z.number().optional(),
  facing: z.number().optional(),
  moving: z.boolean().optional(),
  cut: z.boolean().optional(),
  through: z.boolean().optional(),
  pose: z.string().optional(),
  frame: z.number().int().min(0).optional(),
  y: z.number().optional(),
  shiver: z.number().optional(),
  density: z.number().optional(),
  face: z.string().optional(),
})

export const cutsceneSchema: z.ZodType<CutsceneScript> = z
  .strictObject({
    id: z.string().min(1),
    duration: z.number().min(0),
    lens: z.number().positive().optional(),
    camera: z.array(cameraKey).min(1),
    actor: z.array(actorKey).optional(),
    caption: z
      .array(
        z.strictObject({
          t: z.number(),
          until: z.number(),
          line: z.string().min(1),
          speaker: z.string().optional(),
        }),
      )
      .optional(),
    light: z.array(z.strictObject({ t: z.number(), lamp: z.string().min(1), level: z.number() })).optional(),
    sound: z.array(z.strictObject({ t: z.number(), kind: z.string().min(1) })).optional(),
    doors: z
      .array(
        z.strictObject({
          t: z.number(),
          door: z.string().min(1),
          open: z.number().min(0).max(1),
          ease: easeSchema.optional(),
        }),
      )
      .optional(),
    time: z.array(z.strictObject({ t: z.number(), time: z.string().min(1) })).optional(),
    grade: z.array(z.strictObject({ t: z.number(), grade: z.string().min(1) })).optional(),
    props: z
      .array(
        z.strictObject({
          t: z.number(),
          prop: z.string().min(1),
          at: v3.optional(),
          turn: z.number().optional(),
          hidden: z.boolean().optional(),
          ease: easeSchema.optional(),
        }),
      )
      .optional(),
    cues: z
      .array(z.strictObject({ at: z.number().min(0), who: z.string().min(1), clip: z.string().min(1) }))
      .optional(),
    shake: z.array(z.tuple([z.number(), z.number(), z.number()])).optional(),
    flicker: z.array(z.tuple([z.number(), z.number()])).optional(),
    fade: z.array(z.strictObject({ t: z.number(), value: z.number() })).optional(),
    states: z.array(z.strictObject({ t: z.number(), state: z.string().min(1) })).optional(),
    victory: z.boolean().optional(),
    lintAllow: z
      .array(z.strictObject({ rule: z.string(), reason: z.string(), context: z.string().optional() }))
      .optional(),
  })
  .superRefine((script, ctx) => {
    script.camera.forEach((k, i) => {
      const before = script.camera[i - 1]
      if (before !== undefined && k.t < before.t)
        ctx.addIssue({
          code: 'custom',
          path: ['camera', i, 't'],
          message: `key at ${k.t} is before the one before it (${before.t})`,
        })
    })
    const last = new Map<string, number>()
    ;(script.actor ?? []).forEach((a, i) => {
      const placed = (a.at !== undefined ? 1 : 0) + (a.x !== undefined || a.z !== undefined ? 1 : 0)
      const point = a.x !== undefined && a.z !== undefined
      if (placed !== 1 || (a.at === undefined && !point))
        ctx.addIssue({
          code: 'custom',
          path: ['actor', i],
          message: `actor ${a.who} needs an anchor \`at\`, or both \`x\` and \`z\``,
        })
      const before = last.get(a.who)
      if (before !== undefined && a.t < before)
        ctx.addIssue({
          code: 'custom',
          path: ['actor', i, 't'],
          message: `key at ${a.t} is before ${a.who}'s one before it (${before})`,
        })
      last.set(a.who, a.t)
    })
    ;(script.caption ?? []).forEach((c, i) => {
      if (c.until <= c.t)
        ctx.addIssue({
          code: 'custom',
          path: ['caption', i, 'until'],
          message: `ends at ${c.until}, not after it starts (${c.t})`,
        })
    })
  })
