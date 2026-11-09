// The garment registry (H1): every garment kind by name, in the order a figure's garments are told apart. The
// core set (cap … trousers, outfit/garments/classic-kinds.ts) is registered the same way an
// extension's wardrobe is, so there is one path to a garment and one place that lists them.
//
// A kind is: the shape of its item (`schema`, which the figure's schema parses an item with), then either how it
// is built into the dressed body (`build`, an extension wardrobe's style: it returns a fit) or how it is worn on the body being
// dressed (`wear`, classic-style: it repaints regions and adds parts). Which kind an item is, is the first
// registered kind whose name is one of the item's keys.

import type { z } from 'zod'
import { RegistryClash } from '../../../shared/registry/registry-clash.ts'
import type { Measure } from '../body/genes.ts'
import type { Skeleton } from '../body/rig.ts'
import type { SWATCH_KINDS, SWATCH_ROLES } from '../content/swatch.schema.ts'
import type { Garment } from '../figure/garment.schema.ts'
import type { Dressing } from '../outfit/garments/classic.ts'
import type { Fit, Legs, Wearing, Worn } from './garment-fit.ts'

/**
 * Where a garment is worn: next to the skin, the base top, over a top, the bottoms, on the feet, or an
 * accessory.
 */
export type Layer = 'under' | 'top' | 'outer' | 'bottom' | 'shoes' | 'accessory'
/** What a swatch is, apart from its colour: its cloth and finish, so a recoloured garment keeps its cloth. */
export type Kind = (typeof SWATCH_KINDS)[number]
/**
 * What a swatch is for in a garment: a garment's main cloth, a rib, its inside, a trim, a stitch, a sole,
 * hardware, a lens.
 */
export type Role = (typeof SWATCH_ROLES)[number]
/**
 * The roles of swatch a field of each role takes: a trim any garment's cloth or metal as well as a trim's
 * own.
 */
export const TAKES: Readonly<Record<Role, readonly Role[]>> = {
  main: ['main'],
  rib: ['rib'],
  inside: ['inside'],
  trim: ['trim', 'main', 'hardware'],
  stitch: ['stitch'],
  sole: ['sole'],
  hardware: ['hardware'],
  lens: ['lens'],
}

/** A garment kind. */
export interface GarmentKind {
  /** The shape of one item, defaults written in; parses the item a figure's file names. */
  readonly schema: z.ZodType<Garment>
  /** Where it is worn; left out for a kind the random cast never picks. */
  readonly layer?: Layer
  /** Its swatch fields, each its role and the kinds of swatch it takes, its own cloth first. */
  readonly swatches: Readonly<Record<string, readonly [Role, ...Kind[]]>>
  /** Built into the dressed body as a fit: its parts, marks, repainted regions and openings. */
  readonly build?: (w: Wearing, item: Garment) => Fit
  /** Worn on the body being dressed: repaints regions and adds parts. */
  readonly wear?: (d: Dressing, item: Garment) => void
  /** Built after the rest of the outfit, on what is worn by then (shades pushed up onto the hair or a cap). */
  readonly last?: boolean
  /** A top as worn: what goes over it clears it, a chain lies on it. */
  readonly top?: (m: Measure, s: Skeleton, item: Garment, garments: readonly Garment[]) => Worn
  /** A bottom's cut: what a top over it clears. */
  readonly cut?: (m: Measure, s: Skeleton, item: Garment) => Legs
}

/** The kinds, by name, in registration order. The reading side of the registry; `registerGarment` is the only writer. */
export const GARMENTS: Readonly<Record<string, GarmentKind>> = Object.create(null)

/** Registers a garment kind under `name`, the key its items carry (`{ cape = "red" }`). Throws `RegistryClash` on a taken name. */
export function registerGarment(name: string, kind: GarmentKind): void {
  if (Object.hasOwn(GARMENTS, name)) throw new RegistryClash('garment', name)
  ;(GARMENTS as Record<string, GarmentKind>)[name] = kind
}

/** The kind called `name`, if registered. */
export const garmentKind = (name: string): GarmentKind | undefined => GARMENTS[name]

/** Every registered name, in registration order. */
export const registeredGarments = (): string[] => Object.keys(GARMENTS)

/** The registered name of a garment (the field naming its own cloth), or undefined for one not in the registry. */
export const garmentOf = (g: Garment): string | undefined => Object.keys(GARMENTS).find((name) => name in g)
/** The kinds of swatch a garment's field takes (the registry's), if the garment is in it. */
export const roleOf = (g: Garment, field: string): Kind[] | undefined =>
  GARMENTS[garmentOf(g) ?? '']?.swatches[field]?.slice(1) as Kind[] | undefined
/** The role a garment's field plays (the registry's), if the garment is in it. */
export const fieldRole = (g: Garment, field: string): Role | undefined =>
  GARMENTS[garmentOf(g) ?? '']?.swatches[field]?.[0]
