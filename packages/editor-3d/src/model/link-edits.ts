// The link edits (ED3D.7c, ED3D spec §5.4: for Last Light, nav edge add and remove): a link between two things, added
// or removed as one undo step, labelled `Link a–b` and `Unlink a–b` (the core names no nav edge). Which links a level has, and what refuses one, is the profile's `ThingLinks`; a level
// whose profile has none refuses both.
import { GeometryError } from '../profile/level-profile'
import { ThingAccessError } from '../profile/thing-access'
import type { ThingLink } from '../profile/thing-links'
import { type Edit, type EditResult, ok, refuse } from './edit'

const NO_LINKS = 'this level has no links'

/** The level `write` makes, or its sentence when the profile, or the level's geometry, refuses. */
function written<D>(write: () => D): EditResult<D> {
  try {
    return ok(write())
  } catch (error) {
    if (error instanceof ThingAccessError || error instanceof GeometryError) return refuse(error.message)
    throw error
  }
}

export function addLink<D>(link: ThingLink): Edit<D> {
  const { a, b } = link
  return {
    id: 'link.add',
    label: `Link ${a}–${b}`,
    run(profile, level) {
      const { links } = profile
      if (links === undefined) return refuse(NO_LINKS)
      return written(() => links.add(level, link, profile.geometry(level)))
    },
  }
}

export function removeLink<D>(link: Pick<ThingLink, 'a' | 'b'>): Edit<D> {
  const { a, b } = link
  return {
    id: 'link.remove',
    label: `Unlink ${a}–${b}`,
    run(profile, level) {
      const { links } = profile
      if (links === undefined) return refuse(NO_LINKS)
      return written(() => links.remove(level, a, b))
    },
  }
}
