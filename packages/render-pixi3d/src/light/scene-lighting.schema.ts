// A room's light as content (M3 spec §4.3: `SceneLighting { lamps, ambient }`; 2026-10-16 spec §4.4: occlusion
// takes boxes and planes from the room's content). Presentation only: the sim never reads it (law 1); it switches a
// lamp through a render-row field instead (`Pixi3dOptions.lamps`).
import { z } from 'zod'

/** A colour as 0xRRGGBB (TOML writes it as a hex integer). */
const colour = z.number().int().min(0).max(0xffffff)
const metres = z.number().finite()
const size = z.number().positive()

export const lampSchema = z.object({
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
export const occluderBoxSchema = z.object({
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
export const occluderPlaneSchema = z.object({
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
export const sceneFogSchema = z
  .object({ near: z.number().min(0), far: z.number().positive(), color: colour })
  .refine((fog) => fog.far > fog.near, { message: 'fog far must be past near', path: ['far'] })

export const sceneLightingSchema = z
  .object({
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

export type Lamp = z.output<typeof lampSchema>
export type OccluderBox = z.output<typeof occluderBoxSchema>
export type OccluderPlane = z.output<typeof occluderPlaneSchema>
export type SceneFog = z.output<typeof sceneFogSchema>
/** A room's lamps, ambient light, occluders and fog, compiled from `content/lighting/*.toml`. */
export type SceneLighting = z.output<typeof sceneLightingSchema>
