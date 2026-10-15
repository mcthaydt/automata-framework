export interface ShowcaseGame {
  id: string; title: string; tagline: string; description: string; relationship: string; bundleUrl?: string
}
export const SHOWCASE_GAMES: ShowcaseGame[] = [
  { id: 'emberwick', title: 'Emberwick', tagline: 'The playable 2D starter.', relationship: 'Automata starter', bundleUrl: '/demos/base-2d/index.html', description: 'A lantern-bearer in a single mossy room. Explore movement, jumping, pixel rendering and the splash-to-game lifecycle in the bundled starter.' },
  { id: 'floorfifty', title: 'FloorFifty', tagline: 'A source of production experience.', relationship: 'Reference project', description: 'FloorFifty informed Automata’s 2D, content and hosting architecture. It is a reference project, not presented here as a verified Automata consumer.' },
  { id: 'the-last-light', title: 'The Last Light', tagline: 'A reference for the rendering work.', relationship: 'Reference project', description: 'The Last Light informed the framework’s rendering direction. Its experimental scenes are distinct from the bundled Automata 2D starter.' },
]
