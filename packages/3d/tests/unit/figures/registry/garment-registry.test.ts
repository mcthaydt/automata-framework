// The garment registry (spec 8.2, H1): every garment kind, the classic set included, is registered by name. A
// second registration of a name fails and says so, so a game never silently gets the wrong look.

import { describe, expect, it } from 'vitest'
import { garmentSchema } from '#src/features/figures/figure/garment.schema.ts'
import {
  garmentKind,
  registeredGarments,
  registerGarment,
} from '#src/features/figures/registry/garment-registry.ts'
import { RegistryClash } from '#src/shared/registry/registry-clash.ts'
import '#src/features/figures/outfit/garments/classic-kinds.ts'

const CORE = ['cap', 'cape', 'eyes', 'hair', 'shoes', 'top', 'trousers']

describe('the garment registry', () => {
  it('refuses a second registration of a name, naming it', () => {
    const cape = garmentKind('cape')
    if (!cape) throw new Error('the classic cape is not registered')
    expect(() => registerGarment('cape', cape)).toThrow('A garment called "cape" is already registered')
    expect(() => registerGarment('cape', cape)).toThrow(RegistryClash)
  })
  it('core registers exactly cap, cape, eyes, hair, shoes, top, trousers: a wardrobe is an extension', () => {
    expect([...registeredGarments()].sort()).toEqual(CORE)
  })
  it('a garment the character kit owns is not a garment without it, and says so', () => {
    for (const name of ['apron', 'belt', 'coat', 'gloves', 'legs', 'mark', 'skirt', 'waistcoat'])
      expect(garmentSchema.safeParse({ [name]: 'red' }).success).toBe(false)
  })
  it('parses an item with its kind’s own schema, at the field that is wrong', () => {
    expect(garmentSchema.safeParse({ cape: 'red' }).success).toBe(true)
    const bad = garmentSchema.safeParse({ cape: 'red', length: 'long' })
    expect(bad.success).toBe(false)
    expect(bad.error?.issues[0]?.path).toEqual(['length'])
  })
})
