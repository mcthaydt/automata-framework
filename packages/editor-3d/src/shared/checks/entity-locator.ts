// Where an entity problem points: the selection of the thing, framed at its place when it has one. Shared by the
// entity check and the ref check so both locate a thing the same way.
import type { EntityRef, Thing } from '../things/things'
import { entitySelection, type Locator, place } from './check'

export const entityLocator = ({ def, id, at }: EntityRef): Locator | undefined =>
  place(() => entitySelection(def, id), at)

export const thingLocator = (thing: Thing): Locator | undefined =>
  entityLocator({ def: thing.def, id: thing.id, at: { x: thing.x, z: thing.z } })
