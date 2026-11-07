// The dressed base scenes: core's bare interior and exterior with one place furnished, a waiting room and a street.
import { BASE_SCENES } from '@automata/3d/base'
import { buildWorld } from '@automata/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { dressedBaseScenes } from '#src/app/dressed-base-scenes.ts'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'

const PAIRS = [
  ['base-interior-dressed', 'base-interior', 'room'],
  ['base-exterior-dressed', 'base-exterior', 'pavement'],
] as const

describe('the dressed base scenes', () => {
  for (const [dressed, bare, room] of PAIRS) {
    it(`${dressed} is ${bare} with more in ${room}, and builds with core alone`, () => {
      const scene = dressedBaseScenes[dressed]
      expect(scene.name).toBe(dressed)
      expect(scene.dress).toBeUndefined()
      const before = BASE_SCENES[bare].props ?? []
      const after = scene.props ?? []
      expect(after.length).toBeGreaterThan(before.length)
      // What the bare scene had by hand stays exactly where it was.
      for (const prop of before) expect(after).toContainEqual(prop)
      expect(scene.cast).toEqual(BASE_SCENES[bare].cast)
      expect(buildWorld(scene, worldKitLibrary).problems).toEqual([])
    })
  }
})
