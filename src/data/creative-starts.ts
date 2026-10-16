/** These are playable starters and feature demos, not community submissions. */
export const CREATIVE_STARTS = [
  {
    title: 'Emberwick',
    kind: 'Platformer starter',
    description: 'A lantern. A ledge. One more try. Run and jump to the ember, then make the next room your own.',
    image: '/previews/emberwick.png', alt: 'Emberwick platforming gameplay',
    href: '/examples?demo=base-2d', action: 'Play Emberwick',
    nextHref: '/examples?demo=base-2d&file=examples/base-2d/src/content/room.ts', next: 'Remix the room',
  },
  {
    title: 'Jump. Then jump again.',
    kind: 'Playable first change',
    description: 'Toggle a second jump and feel the difference. The prompt, source, and tests are all there to follow.',
    image: '/previews/double-jump.png', alt: 'The double-jump remix of Emberwick',
    href: '/start#worked-change', action: 'Try a double jump',
    nextHref: '/start#first-task', next: 'Copy the double-jump prompt',
  },
  {
    title: 'Drop it. Push it. Pile it up.',
    kind: 'Physics playground',
    description: 'Drop crates into the room and shove them around. Start from working collisions for your own physics toy.',
    image: '/previews/bodies-2d.png', alt: 'Physics bodies and crates in the playable room',
    href: '/examples?demo=bodies-2d', action: 'Play with physics',
    nextHref: '/ai#prompt-game-rule', next: 'Give your agent the next idea',
  },
]
