// Every koota form that builds no code: an array-of-structures factory, a tag, a relation with no store, a factory
// store. A type-only import is never a call.

import type { Trait } from 'koota'
import { relation, trait } from 'koota'

export const Position = trait(() => ({ x: 0, y: 0 }))
export const Named = trait(function make() {
  return { name: '' }
})
export const IsPlayer = trait()
export const IsEnemy = trait({})
export const ChildOf = relation()
export const Targets = relation({ exclusive: true })
export const Owes = relation({ store: () => ({ amount: 0 }) })
export const Likes = relation({
  store() {
    return { weight: 1 }
  },
})
export const Tagged = relation({ store: {} })
export type Any = Trait
