export interface ShowcaseGame {
  id: string
  title: string
  tagline: string
  description: string
  dimension: '2D' | '2.5D' | '3D'
  platforms: string[]
  tags: string[]
  bundleUrl?: string
  externalUrl?: string
  repoUrl?: string
  highlights: string[]
}

export const SHOWCASE_GAMES: ShowcaseGame[] = [
  {
    id: 'emberwick',
    title: 'Emberwick',
    tagline: 'Retro dungeon exploration adventure in the Endesga 64 palette.',
    description:
      'The flagship 2D base project for Automata. Implements a complete character-in-a-room lifecycle (splash → menu → room → pause → end) with fixed 60Hz physics, sub-tick sprite interpolation, and custom vignette shaders.',
    dimension: '2D',
    platforms: ['Web', 'Ruken App', 'Desktop'],
    tags: ['WebGL2', 'Rapier 2D', 'Endesga 64', 'Deterministic Replays'],
    bundleUrl: '/demos/base-2d/index.html',
    repoUrl: 'https://github.com/mcthaydt/automata-framework/tree/main/examples/base-2d',
    highlights: [
      'Sub-tick sprite interpolation across 60Hz / 120Hz / 144Hz displays',
      'Bit-identical golden replay hash: 31f50888ccb4cf0a',
      'Endesga 64 color token mapping with custom no-eval shaders',
      'Zero-eval CSP compliant for Ruken mobile runtime',
    ],
  },
  {
    id: 'floorfifty',
    title: 'FloorFifty',
    tagline: 'Modular turn-based puzzle game deployed on Ruken.',
    description:
      'A sophisticated modular puzzle game built on Ruken and Automata sim principles. Features deterministic replay recording, content compilation, and state reconciliation.',
    dimension: '2D',
    platforms: ['Ruken App', 'Web'],
    tags: ['Koota ECS', 'Flow State', 'Replay Codec', 'Svelte UI'],
    externalUrl: 'https://github.com/SNEKPRTY/FloorFifty',
    repoUrl: 'https://github.com/SNEKPRTY/FloorFifty',
    highlights: [
      'Proven test suite of 13 Ruken integration contract tests',
      'Full .replay v1 recording, playback, and bisection',
      'Mobile-first responsive UI tested across 780×270 viewports',
    ],
  },
  {
    id: 'the-last-light',
    title: 'The Last Light',
    tagline: 'Atmospheric 2.5D lighting and survival simulation experiment.',
    description:
      'The experimental reference for Automata 2.5D pipelines. Combines fixed-camera rooms, lit sprite atlases with normal maps, and custom shaders.',
    dimension: '2.5D',
    platforms: ['Web', 'Desktop'],
    tags: ['PixiJS 3D', 'Normal Maps', 'Dynamic Lighting', 'GLB Props'],
    externalUrl: 'https://github.com/mcthaydt/PixiJS3D_Experiment_001',
    repoUrl: 'https://github.com/mcthaydt/PixiJS3D_Experiment_001',
    highlights: [
      '2.5D character pipeline: lit sprite atlas with normal map shaders',
      'GLB props pipeline with budget validators',
      'Fixed-camera sector navigation and room boundaries',
    ],
  },
]
