export interface ShowcaseGame {
  id: string
  title: string
  tagline: string
  description: string
  relationship: string
  bundleUrl?: string
}
export const SHOWCASE_GAMES: ShowcaseGame[] = [
  {
    id: 'emberwick',
    title: 'Emberwick',
    tagline: 'The playable 2D starter.',
    relationship: 'Automata starter',
    bundleUrl: '/demos/emberwick/index.html',
    description:
      'A lantern-bearer in a single mossy room. Explore movement, jumping, pixel rendering and the splash-to-game lifecycle in the bundled starter.',
  },
]

export interface CommunityGame {
  id: string
  title: string
  creator: string
  description: string
  url: string
  image?: string
}
// Only reviewed, permissioned community games belong here.
export const COMMUNITY_GAMES: CommunityGame[] = []
const submission = new URL('https://github.com/mcthaydt/automata-framework/issues/new')
submission.searchParams.set('title', 'Showcase submission: ')
submission.searchParams.set(
  'body',
  `Game title:
Creator name:
Public playable URL:
Short description:
Automata version and packages used:
Screenshot URLs:
Permission to feature the supplied description/screenshots:
`,
)
export const SHOWCASE_SUBMISSION_URL = submission.href
