// The kit's wall things say they hang on a wall, so the world builder links them to it and the occluder rule hides them
// with it: a frame, a pinboard, a radiator, a vent, a clock and a key cabinet. What stands on the floor says nothing.
import { isFault, resolveProp } from '@automataframework/3d/props-kit'
import { describe, expect, it } from 'vitest'
import { worldKitLibrary } from '#src/app/world-kit-library.ts'
import '#src/features/props/register-props.ts'

const mountsOf = (name: string): (string | undefined)[] => {
  const resolved = resolveProp({ use: name }, worldKitLibrary)
  if (isFault(resolved)) throw new Error(`${name}: ${resolved.code}`)
  return resolved.generator(resolved.params).pieces.map((piece) => piece.mount)
}

describe('wall-mounted props', () => {
  it.each([
    'picture.sea',
    'noticeboard',
    'radiator',
    'fixture.vent',
    'fixture.switch',
    'fixture.outlet',
    'fixture.conduit',
    'wallClock',
    'keyCabinet',
    'sign.cream',
  ])('%s: every part is hung on the wall', (name) => {
    const mounts = mountsOf(name)
    expect(mounts.length).toBeGreaterThan(0)
    expect(mounts.every((mount) => mount === 'wall')).toBe(true)
  })

  it.each(['chair.wood', 'desk', 'bookcase', 'crate', 'cabinet.filing'])(
    '%s: stands on the floor and is hung on nothing',
    (name) => {
      expect(mountsOf(name).every((mount) => mount === undefined)).toBe(true)
    },
  )
})
