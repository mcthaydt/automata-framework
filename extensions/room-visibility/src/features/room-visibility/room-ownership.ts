// Ownership in the 3D scene: each room's content sits under an identity "mask" parent, and a frame's set of visible rooms
// switches the masks. The mask isolates the room's visibility from each leaf's own (a lamp, a door and a fading wall all
// toggle `visible` themselves), so the two never fight. Needs `@pixi/3d`.

import { Container3D } from '@pixi/3d'
import type { RoomOwners, RoomPolicy } from './room-policy.schema.ts'

export interface RoomOwnership {
  /** Puts a direct child of the root under the rooms that own it (`global` always draws). Owning it again changes its owners. */
  own<T extends Container3D>(node: T, owners: RoomOwners): T
  /** A new, empty child of the root, owned by `owners`: a layer to draw one room's content into. */
  layer(owners: RoomOwners): Container3D
  /** Like `own`, and the owners are asked again at every `apply` (for a node that moves between rooms). */
  follow<T extends Container3D>(node: T, owners: () => RoomOwners): T
  /** The owners `scope` is building under, if any. */
  current(): RoomOwners | undefined
  /** Runs a build with `owners` as `current()`, so a builder can own what it makes without being handed the owners. */
  scope<T>(owners: RoomOwners, build: () => T): T
  owners(node: Container3D): RoomOwners | undefined
  /** Draws the owned content of the visible rooms and hides the rest. */
  apply(visible: ReadonlySet<string>): void
  /** Throws, naming it, if the root holds content no room owns (it would draw in every room). */
  assertComplete(): void
  dispose(): void
}

export function createRoomOwnership(root: Container3D, policy: RoomPolicy): RoomOwnership {
  const entries = new Map<Container3D, { mask: Container3D; owners: RoomOwners }>()
  const followers = new Map<Container3D, () => RoomOwners>()
  let active: RoomOwners | undefined
  const copy = (owners: RoomOwners): RoomOwners => (owners === 'global' ? owners : [...owners])
  const valid = (owners: RoomOwners): void => {
    if (owners !== 'global' && (!owners.length || owners.some((id) => !Object.hasOwn(policy.rooms, id))))
      throw new Error('unknown or empty room owners')
  }
  const own = <T extends Container3D>(node: T, owners: RoomOwners): T => {
    valid(owners)
    const existing = entries.get(node)
    if (existing) {
      existing.owners = copy(owners)
      return node
    }
    if (node.parent !== root) throw new Error('nested ownership must inherit its root node')
    const mask = new Container3D()
    mask.label = 'room-mask'
    root.addChildAt(mask, root.getChildIndex(node))
    mask.addChild(node)
    entries.set(node, { mask, owners: copy(owners) })
    return node
  }
  return {
    own,
    layer(owners) {
      valid(owners)
      const node = new Container3D()
      node.label = 'room-layer'
      root.addChild(node)
      return own(node, owners)
    },
    follow(node, owners) {
      own(node, owners())
      followers.set(node, owners)
      return node
    },
    current: () => active,
    scope(owners, build) {
      valid(owners)
      const previous = active
      active = owners
      try {
        return build()
      } finally {
        active = previous
      }
    },
    owners: (node) => entries.get(node)?.owners,
    apply(visible) {
      for (const [node, owners] of followers) own(node, owners())
      for (const { mask, owners } of entries.values())
        mask.visible = owners === 'global' || owners.some((id) => visible.has(id))
    },
    assertComplete() {
      const masks = new Set([...entries.values()].map((e) => e.mask))
      const unowned = root.children.filter((node) => !masks.has(node as Container3D))
      if (unowned.length)
        throw new Error(
          `unowned room content: ${unowned.map((node) => node.label || node.constructor.name).join('; ')}`,
        )
    },
    dispose() {
      followers.clear()
      entries.clear()
      active = undefined
    },
  }
}
