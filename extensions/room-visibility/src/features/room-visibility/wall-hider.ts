// Applies a zone's hidden wall groups to whatever draws the walls. A node is anything with `visible` (a `Container3D`, a
// mesh): the hider never imports the renderer.

export interface Hideable {
  visible: boolean
}

export interface WallHider {
  /** Puts nodes in a cutaway group. */
  add(group: string, ...nodes: Hideable[]): void
  remove(node: Hideable): void
  /** The groups that hold at least one node. */
  groups(): string[]
  /** Hides every node of the given groups and shows every other. */
  apply(hidden: ReadonlySet<string>): void
}

export function createWallHider(): WallHider {
  const held = new Map<string, Set<Hideable>>()
  return {
    add(group, ...nodes) {
      const set = held.get(group) ?? new Set<Hideable>()
      held.set(group, set)
      for (const node of nodes) set.add(node)
    },
    remove(node) {
      for (const [group, set] of held) {
        set.delete(node)
        if (set.size === 0) held.delete(group)
      }
    },
    groups: () => [...held.keys()],
    apply(hidden) {
      for (const [group, set] of held) for (const node of set) node.visible = !hidden.has(group)
    },
  }
}
