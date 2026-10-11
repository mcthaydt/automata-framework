// The gallery's list: every feature demo, raylib-examples style (examples/README.md). Add a demo here when it
// lands; gallery.test.ts fails while a demo folder is missing from this list or the list names a missing one.
// A screenshot is added only after the Owner approves it (examples/README.md, Checked).

export interface GalleryDemo {
  /** The folder under examples/, `<package>/<demo>`. */
  readonly path: string
  /** Its workspace package, for `pnpm --filter <package> dev`. */
  readonly package: string
  readonly title: string
  /** One sentence: what the demo shows. */
  readonly shows: string
  /** The base it builds on, or 'none'. */
  readonly base: 'base-2d' | 'none'
  /** Under examples/gallery/screenshots/, once approved. */
  readonly screenshot?: string
}

export const DEMOS: readonly GalleryDemo[] = [
  {
    path: 'host/lifecycle-and-saves',
    package: '@af-examples/host-lifecycle-and-saves',
    title: 'Host: lifecycle and saves',
    shows: 'Waits for the host, pauses in the background, and keeps a best time in the player’s host saves.',
    base: 'base-2d',
  },
  {
    path: 'content/hot-reload',
    package: '@af-examples/content-hot-reload',
    title: 'Content: hot reload',
    shows: 'The room as a TOML file: save it and the room changes in place; a bad save shows what is wrong.',
    base: 'base-2d',
  },
  {
    path: 'physics/bodies-2d',
    package: '@af-examples/physics-bodies-2d',
    title: 'Physics: bodies 2D',
    shows:
      'Fixed, kinematic and dynamic Rapier bodies: Wick shoves crates and stones that tumble and pile up.',
    base: 'base-2d',
  },
  {
    path: 'ui/primitives',
    package: '@af-examples/ui-primitives',
    title: 'UI: primitives',
    shows: 'Every ui primitive at every reference size, phone first.',
    base: 'none',
  },
]
