/** These are playable starters and feature demos, not community submissions. */
export const CREATIVE_STARTS = [
  {
    title: 'Emberwick',
    description: 'A lantern. A ledge. One more try. Run and jump to the ember, then make the next room your own.',
    image: '/previews/emberwick.jpg', alt: 'Emberwick platforming gameplay',
    href: '/examples?demo=base-2d', action: 'Play Emberwick',
    nextHref: '/examples?demo=base-2d&file=games/emberwick/src/shared/room.ts', next: 'Remix the room',
  },
  {
    title: 'Jump. Then jump again.',
    description: 'Toggle a second jump and feel the difference. The prompt, source, and tests are all there to follow.',
    image: '/previews/double-jump.jpg', alt: 'The double-jump remix of Emberwick',
    href: '/start#first-task', action: 'Try a double jump',
    nextHref: '/start#first-task', next: 'Copy the double-jump prompt',
  },
]
