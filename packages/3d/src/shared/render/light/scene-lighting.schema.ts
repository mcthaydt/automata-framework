// A room's light as content (`SceneLighting { lamps, ambient }`; occlusion
// takes boxes and planes from the room's content). Presentation only: the sim never reads it (law 1); it switches a
// lamp through a render-row field instead (`Pixi3dOptions.lamps`).
import { z } from 'zod'

/** A colour as 0xRRGGBB (TOML writes it as a hex integer). */
const colour = z.number().int().min(0).max(0xffffff)
const metres = z.number().finite()
const size = z.number().positive()

export const lampSchema: z.ZodType<Lamp> = z.strictObject({
  /** Unique within its file: the sim switches the lamp by this id. */
  id: z.string().min(1),
  x: metres,
  y: metres,
  z: metres,
  color: colour,
  /** Light at the lamp before falloff; 1 by default. */
  strength: z.number().min(0).default(1),
  /** Metres: nothing past it is lit, and light falls off as `(1 - d / range)²`. */
  range: size,
  /** The level before the sim says otherwise: 0 is off, 1 full; 1 by default. */
  level: z.number().min(0).default(1),
})

/** A solid box that blocks light (and darkens the floor round its foot). `y` is its base, as a box view stands. */
export const occluderBoxSchema: z.ZodType<OccluderBox> = z.strictObject({
  /** A static mesh can name it in `bake(mesh, { ignore })` so a broad collider never shadows its own surfaces. */
  id: z.string().min(1).optional(),
  x: metres,
  y: metres,
  z: metres,
  width: size,
  height: size,
  depth: size,
})

/**
 * A flat rectangle (a wall, a floor, a ceiling) that blocks light from either side, and darkens surfaces in front of
 * it (on its `normal`'s side) where they meet it. `width` runs horizontally along it (along x for a floor), `height`
 * along the other axis.
 */
export const occluderPlaneSchema: z.ZodType<OccluderPlane> = z.strictObject({
  x: metres,
  y: metres,
  z: metres,
  normal: z
    .tuple([metres, metres, metres])
    .refine(([x, y, z]) => Math.hypot(x, y, z) > 1e-6, 'a normal must not be zero')
    .transform(([x, y, z]): [number, number, number] => {
      const length = Math.hypot(x, y, z)
      return [x / length, y / length, z / length]
    }),
  width: size,
  height: size,
})

/** `View3D`'s linear fog: none before `near` metres from the camera, full at `far`. */
export const sceneFogSchema: z.ZodType<SceneFog> = z
  .strictObject({ near: z.number().min(0), far: z.number().positive(), color: colour })
  .refine((fog) => fog.far > fog.near, { message: 'fog far must be past near', path: ['far'] })

export const sceneLightingSchema: z.ZodType<SceneLighting> = z
  .strictObject({
    /** Light everywhere, 0 to 1, before any lamp. */
    ambient: z.number().min(0).max(1),
    ambientColor: colour.default(0xffffff),
    lamps: z.array(lampSchema).default([]),
    boxes: z.array(occluderBoxSchema).default([]),
    planes: z.array(occluderPlaneSchema).default([]),
    fog: sceneFogSchema.optional(),
  })
  .superRefine((lighting, context) => {
    const seen = new Set<string>()
    lighting.lamps.forEach((lamp, index) => {
      if (seen.has(lamp.id))
        context.addIssue({
          code: 'custom',
          message: `lamp id "${lamp.id}" is used twice`,
          path: ['lamps', index, 'id'],
        })
      seen.add(lamp.id)
    })
  })

/** A point light: where it hangs, its colour, strength and reach, and its level before the sim switches it. */
export interface Lamp {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly z: number
  /** 0xRRGGBB. */
  readonly color: number
  readonly strength: number
  /** Metres. */
  readonly range: number
  readonly level: number
}

/** A box that blocks light: centred on `x` and `z`, standing on `y`. */
export interface OccluderBox {
  readonly id?: string | undefined
  readonly x: number
  readonly y: number
  readonly z: number
  readonly width: number
  readonly height: number
  readonly depth: number
}

/** A rectangle that blocks light, centred on `x`, `y`, `z`, facing its unit `normal`. */
export interface OccluderPlane {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly normal: readonly [number, number, number]
  readonly width: number
  readonly height: number
}

/** Linear fog: none before `near` metres from the camera, full (`color`, 0xRRGGBB) at `far`. */
export interface SceneFog {
  readonly near: number
  readonly far: number
  readonly color: number
}

/** A room's lamps, ambient light, occluders and fog, compiled from `content/lighting/*.toml`. */
export interface SceneLighting {
  /** 0 to 1. */
  readonly ambient: number
  /** 0xRRGGBB. */
  readonly ambientColor: number
  readonly lamps: readonly Lamp[]
  readonly boxes: readonly OccluderBox[]
  readonly planes: readonly OccluderPlane[]
  readonly fog?: SceneFog | undefined
}
