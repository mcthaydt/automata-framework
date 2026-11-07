// The garment registry (spec 8.2, H1): every garment kind, the classic set included, is registered by name. A
// second registration of a name fails and says so, so a game never silently gets the wrong look.

import { describe, expect, it } from 'vitest'
import { garmentSchema } from '#src/features/figures/figure/garment.schema.ts'
import {
  garmentKind,
  registeredGarments,
  registerGarment,
} from '#src/features/figures/registry/garment-registry.ts'
import { RegistryClash } from '#src/features/figures/registry/registry-clash.ts'
import '#src/features/figures/outfit/garments/classic-kinds.ts'

const CLASSIC = [
  'apron',
  'belt',
  'cap',
  'cape',
  'coat',
  'eyes',
  'gloves',
  'hair',
  'legs',
  'mark',
  'shoes',
  'skirt',
  'top',
  'trousers',
  'waistcoat',
]

describe('the garment registry', () => {
  it('refuses a second registration of a name, naming it', () => {
    const cape = garmentKind('cape')
    if (!cape) throw new Error('the classic cape is not registered')
    expect(() => registerGarment('cape', cape)).toThrow('A garment called "cape" is already registered')
    expect(() => registerGarment('cape', cape)).toThrow(RegistryClash)
  })
  it('registers only the 15 classic kinds: the streetwear wardrobe is an example extension', () => {
    expect([...registeredGarments()].sort()).toEqual(CLASSIC)
  })
  it('lists the garments in the order a figure tells them apart (a cap’s mark is the cap’s)', () => {
    const names = registeredGarments()
    expect(names.indexOf('cap')).toBeLessThan(names.indexOf('mark'))
  })
  it('parses an item with its kind’s own schema, at the field that is wrong', () => {
    expect(garmentSchema.safeParse({ cape: 'red' }).success).toBe(true)
    const bad = garmentSchema.safeParse({ skirt: 'red', length: 'long' })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.path).toEqual(['length'])
  })
})
