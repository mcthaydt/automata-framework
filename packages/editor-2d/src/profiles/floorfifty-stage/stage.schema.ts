import { z } from 'zod'

// The FloorFifty stage file (2D editor spec §10.2), vendored from `packages/content/src/schema/stage.ts` of FloorFifty
// at commit ee5d44e (FF-D3; see testing/PROVENANCE.md). The rules and their messages are FloorFifty's own, so a stage
// this schema accepts is one the game's content compiler accepts. Two changes from the source: FloorFifty's branded
// content ids are plain strings here, and Zod 4's `strictObject` replaces `.strict()`. What a stage's tuning names mean
// is not decided here, only that each value is a finite number (the checks of EDFF.1b read the tunable declarations).

/** The four readable phrases, in the order a player meets them. */
export const PHRASE_NAMES = ['teach', 'combine', 'recover', 'finish'] as const

const DISPLAY_NAME_MAX_LENGTH = 48
const PURPOSE_MAX_LENGTH = 240

const contentId = z.string().regex(/^[a-z0-9-]+$/)

const notBelowFrom = (entry: { fromFloor: number; toFloor: number }, ctx: z.RefinementCtx): void => {
  if (entry.toFloor < entry.fromFloor)
    ctx.addIssue({ code: 'custom', path: ['toFloor'], message: 'must not be below fromFloor' })
}

/** One named stretch of the climb. `fromFloor` and `toFloor` are inclusive; floor zero is the fixed seat no phrase teaches. */
const phraseSchema = z
  .strictObject({
    name: z.enum(PHRASE_NAMES),
    fromFloor: z.number().int().min(1),
    toFloor: z.number().int().min(1),
    purpose: z.string().min(1).max(PURPOSE_MAX_LENGTH),
  })
  .superRefine(notBelowFrom)

/** A stretch of the climb above the four-phrase arc: unnamed, recorded for a reviewer. */
const extensionSchema = z
  .strictObject({
    fromFloor: z.number().int().min(1),
    toFloor: z.number().int().min(1),
    purpose: z.string().min(1).max(PURPOSE_MAX_LENGTH),
  })
  .superRefine(notBelowFrom)

/** The authored course: the seed that selects the generation, and the phrases that explain it. */
const courseSchema = z
  .strictObject({
    seed: z.number().int().min(0),
    phrases: z.array(phraseSchema),
    extension: z.array(extensionSchema).optional(),
  })
  .superRefine((course, ctx) => {
    const names = course.phrases.map((phrase) => phrase.name)
    if (names.length !== PHRASE_NAMES.length || names.some((name, i) => name !== PHRASE_NAMES[i]))
      ctx.addIssue({
        code: 'custom',
        path: ['phrases'],
        message: `must name ${PHRASE_NAMES.join(', ')} exactly once, in that order`,
      })
  })

/**
 * One scenery layer. `depth` is the parallax factor, `sink` where its roofline starts, `haze` the share stippled toward
 * the sky, `arc` its share of the ascent arc (default `depth / 0.35`) and `drift` its sideways speed.
 */
const layerSchema = z
  .strictObject({
    alias: z.string().min(1),
    plate: z.enum(['sky', 'city']),
    depth: z.number().min(0).max(1),
    sink: z.number().min(-720).max(1440),
    haze: z.number().min(0).max(1).optional(),
    extend: z.enum(['none', 'skirt', 'tile', 'plate']),
    arc: z.number().min(0).max(2).optional(),
    drift: z.number().min(0).max(3).optional(),
  })
  .superRefine((layer, ctx) => {
    if (layer.extend === 'plate' && layer.plate !== 'sky')
      ctx.addIssue({
        code: 'custom',
        path: ['extend'],
        message: 'a full-frame plate is a sky picture: only with plate = "sky"',
      })
    if (layer.arc !== undefined && layer.plate !== 'city')
      ctx.addIssue({
        code: 'custom',
        path: ['arc'],
        message: 'the ascent arc moves the city; a sky layer has none',
      })
    if ((layer.drift ?? 0) > 0 && layer.extend === 'plate')
      ctx.addIssue({
        code: 'custom',
        path: ['drift'],
        message: 'a sky plate is one picture and cannot drift',
      })
  })

/**
 * The composition, back to front. Order is depth: within each plate a layer may not be nearer than the one after it
 * (ties keep list order). A sky plate comes first among the sky layers, because it is drawn behind the light and
 * everything else in front of it.
 */
const layersSchema = z
  .array(layerSchema)
  .min(1)
  .superRefine((layers, ctx) => {
    const seen = new Set<string>()
    const nearest = { sky: 0, city: 0 }
    let skyBefore = false
    layers.forEach((layer, index) => {
      if (layer.extend === 'plate' && skyBefore)
        ctx.addIssue({
          code: 'custom',
          path: [index, 'extend'],
          message:
            'a sky plate is drawn behind the light and the other sky layers, so it must be the first sky layer',
        })
      if (layer.plate === 'sky') skyBefore = true
      if (seen.has(layer.alias))
        ctx.addIssue({
          code: 'custom',
          path: [index, 'alias'],
          message: `${layer.alias} is already in the list`,
        })
      seen.add(layer.alias)
      if (layer.depth < nearest[layer.plate])
        ctx.addIssue({
          code: 'custom',
          path: [index, 'depth'],
          message: `is further than the ${layer.plate} layer before it; list layers back to front`,
        })
      nearest[layer.plate] = Math.max(nearest[layer.plate], layer.depth)
    })
  })

/** The moods a set piece's palette shift steps toward. */
export const SET_PIECE_MOOD_NAMES = [
  'sunset',
  'storm',
  'deepWater',
  'aurora',
  'night',
  'dawn',
  'day',
  'bright',
] as const

// Where a piece plays in a fifty-floor race, and how long it holds.
const setPieceBase = {
  floor: z.number().int().min(1).max(50),
  holdMs: z.number().int().min(500).max(20_000),
}
const layerList = z.array(z.string().min(1)).min(1).max(6)

/** One set piece: a code-owned kind a stage picks and parameterises. */
const setPieceSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...setPieceBase, kind: z.literal('lightsOut'), invert: z.boolean().optional() }),
  z.strictObject({
    ...setPieceBase,
    kind: z.literal('paletteShift'),
    mood: z.enum(SET_PIECE_MOOD_NAMES),
    stay: z.boolean().optional(),
  }),
  z.strictObject({
    ...setPieceBase,
    kind: z.literal('weatherBurst'),
    particle: z.enum(['snow', 'rain', 'bubble']),
    density: z.number().min(0).max(1),
    layers: layerList.optional(),
  }),
  z.strictObject({
    ...setPieceBase,
    kind: z.literal('skyFlash'),
    // Three at most, at no more than three a second (WCAG 2.3.1).
    flashes: z.number().int().min(1).max(3),
    tone: z.enum(['lightning', 'aurora']),
    kick: z.number().min(0).max(4).optional(),
  }),
  z.strictObject({
    ...setPieceBase,
    kind: z.literal('swarm'),
    layers: layerList,
    speed: z.number().min(1).max(20),
  }),
])

/** Cosmetic only, and bounded: these reach a shader, where a value outside the tuned range is a broken picture. */
const presentationSchema = z.strictObject({
  profile: z.literal('aquarian'),
  refractionIntensity: z.number().min(0).max(0.8),
  horizonLift: z.number().min(0).max(48),
  lightHeight: z.number().min(-200).max(600).optional(),
  lightShimmer: z.boolean().optional(),
  silhouette: z.boolean().optional(),
  // How far the city has sunk by the end of each course phrase, in logical units.
  citySink: z
    .strictObject({
      teach: z.number().min(0).max(720),
      combine: z.number().min(0).max(720),
      recover: z.number().min(0).max(720),
      finish: z.number().min(0).max(720),
    })
    .optional(),
})

export type PhraseName = (typeof PHRASE_NAMES)[number]
export type SetPieceMood = (typeof SET_PIECE_MOOD_NAMES)[number]

export interface StagePhrase {
  readonly name: PhraseName
  readonly fromFloor: number
  readonly toFloor: number
  readonly purpose: string
}

export interface StageExtension {
  readonly fromFloor: number
  readonly toFloor: number
  readonly purpose: string
}

export interface StageCourse {
  readonly seed: number
  readonly phrases: readonly StagePhrase[]
  readonly extension?: readonly StageExtension[] | undefined
}

export interface StageLayer {
  readonly alias: string
  readonly plate: 'sky' | 'city'
  readonly depth: number
  readonly sink: number
  readonly haze?: number | undefined
  readonly extend: 'none' | 'skirt' | 'tile' | 'plate'
  readonly arc?: number | undefined
  readonly drift?: number | undefined
}

interface SetPieceBase {
  readonly floor: number
  readonly holdMs: number
}

export type StageSetPiece =
  | (SetPieceBase & { readonly kind: 'lightsOut'; readonly invert?: boolean | undefined })
  | (SetPieceBase & {
      readonly kind: 'paletteShift'
      readonly mood: SetPieceMood
      readonly stay?: boolean | undefined
    })
  | (SetPieceBase & {
      readonly kind: 'weatherBurst'
      readonly particle: 'snow' | 'rain' | 'bubble'
      readonly density: number
      readonly layers?: readonly string[] | undefined
    })
  | (SetPieceBase & {
      readonly kind: 'skyFlash'
      readonly flashes: number
      readonly tone: 'lightning' | 'aurora'
      readonly kick?: number | undefined
    })
  | (SetPieceBase & { readonly kind: 'swarm'; readonly layers: readonly string[]; readonly speed: number })

export type StageSetPieceKind = StageSetPiece['kind']

export interface StageCitySink {
  readonly teach: number
  readonly combine: number
  readonly recover: number
  readonly finish: number
}

export interface StagePresentation {
  readonly profile: 'aquarian'
  readonly refractionIntensity: number
  readonly horizonLift: number
  readonly lightHeight?: number | undefined
  readonly lightShimmer?: boolean | undefined
  readonly silhouette?: boolean | undefined
  readonly citySink?: StageCitySink | undefined
}

export interface StageTheme {
  readonly backdropAlias: string
  readonly lightAlias?: string | undefined
  readonly previewAlias?: string | undefined
  /** Back to front, as in the file. */
  readonly layers: readonly StageLayer[]
  readonly ambienceAlias?: string | undefined
  readonly presentation?: StagePresentation | undefined
  readonly setPieces: readonly StageSetPiece[]
}

/** A stage file's value. `courseTuning` maps a tunable's name to the stage's override. */
export interface StageValue {
  readonly id: string
  readonly displayName: string
  readonly unlock?: string | undefined
  readonly platformAlias: string
  readonly courseTuning: Readonly<Record<string, number>>
  readonly course?: StageCourse | undefined
  readonly theme: StageTheme
}

export const stageSchema: z.ZodType<StageValue> = z.strictObject({
  id: contentId,
  displayName: z.string().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  // Earned by play: the condition's id in unlocks.toml. Absent, the stage is open.
  unlock: contentId.optional(),
  platformAlias: z.string().min(1),
  courseTuning: z.record(z.string(), z.number()),
  course: courseSchema.optional(),
  theme: z.strictObject({
    backdropAlias: z.string().min(1),
    // The sun or the moon. A theme that omits it draws none.
    lightAlias: z.string().min(1).optional(),
    // The select screen's still: the wide picture its preview pans.
    previewAlias: z.string().min(1).optional(),
    layers: layersSchema,
    ambienceAlias: z.string().min(1).optional(),
    presentation: presentationSchema.optional(),
    setPieces: z.array(setPieceSchema).max(16).default([]),
  }),
})
