// The dressed base scenes: core's bare interior and exterior with one place furnished, a waiting room and a street.

import { describe, expect, it } from 'vitest'
import { BASE_SCENES } from '#src/features/world/base/base-scenes.ts'
import { coreLibrary } from '#src/features/world/base/core-library.ts'
import { DRESSED_BASE_SCENES } from '#src/features/world/base/dressed-base-scenes.ts'
import { buildWorld } from '#src/features/world/build.ts'
import '#src/features/world/props/kit/register-kit-props.ts'

const PAIRS = [
  ['base-interior-dressed', 'base-interior', 'room'],
  ['base-exterior-dressed', 'base-exterior', 'pavement'],
] as const

describe('the dressed base scenes', () => {
  for (const [dressed, bare, room] of PAIRS) {
    it(`${dressed} is ${bare} with more in ${room}, and builds with core alone`, () => {
      const scene = DRESSED_BASE_SCENES[dressed]
      expect(scene.name).toBe(dressed)
      expect(scene.dress).toBeUndefined()
      const before = BASE_SCENES[bare].props ?? []
      const after = scene.props ?? []
      expect(after.length).toBeGreaterThan(before.length)
      // What the bare scene had by hand stays exactly where it was.
      for (const prop of before) expect(after).toContainEqual(prop)
      expect(scene.cast).toEqual(BASE_SCENES[bare].cast)
      expect(buildWorld(scene, coreLibrary).problems).toEqual([])
    })
  }
})
