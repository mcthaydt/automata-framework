import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frameworkDocsDir = resolve(__dirname, '../../automata-framework/docs')
const websiteDir = resolve(__dirname, '..')

export interface TocItem {
  id: string
  text: string
  level: number
}

export interface DocSection {
  id: string
  slug: string
  title: string
  category: string
  badge?: string
  description: string
  content: string
  toc: TocItem[]
}

export function extractToc(markdown: string): TocItem[] {
  const lines = markdown.split('\n')
  const toc: TocItem[] = []
  for (const line of lines) {
    const match = line.match(/^(#{2,3})\s+(.+)$/)
    if (match) {
      const level = match[1].length
      const text = match[2].trim().replace(/`/g, '')
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
      toc.push({ id, text, level })
    }
  }
  return toc
}

const DEFAULT_DOCS: Omit<DocSection, 'toc'>[] = [
  {
    id: 'overview',
    slug: 'overview',
    title: 'Overview & Vision',
    category: 'Getting Started',
    badge: 'v0.1',
    description: 'High-level architecture, design laws, and Ruken-first direction.',
    content: `# Overview & Vision

Automata Framework (AF) is a deterministic game framework designed for modern web browsers and the Ruken gaming platform.

> [!NOTE]
> AF is **Ruken first**. Core packages are built from proven code in FloorFifty (2D), The Last Light (PixiJS 3D experiment), and Ruken itself.

## The Seven Architectural Laws

1. **Only the simulation changes gameplay state.** Presentation and UI can observe, but never mutate.
2. **Deterministic simulation.** Pure, synchronous Koota ECS loop yielding bit-identical hashes across Chromium, WebKit, and Firefox.
3. **Effect runs everything outside the sim.** I/O, network, timers, lifecycles, and storage run in Effect. The sim never imports Effect.
4. **Zero eval.** No \`new Function\` or \`eval\` anywhere, guaranteeing compliance with Ruken's strict CSP (\`script-src 'self'\`).
5. **PixiJS renders 2D.** PixiJS v8 powers high-performance WebGL2 and WebGPU graphics.
6. **Sub-tick alpha interpolation.** Simulation runs at fixed 60Hz; presentation computes \`alpha = accumulator / dt\` to interpolate smooth motion for 120Hz/144Hz/240Hz monitors.
7. **The host is a port.** Ruken is the reference host, but desktop (Tauri) and web run identically.

## Package Ecosystem

| Package | Role | Status |
|---|---|---|
| \`@mcthaydt/automata-sim\` | Pure Koota ECS, traits, systems, fixed loop | Core / Stable |
| \`@mcthaydt/automata-runtime\` | Boot sequence, Effect loop runner, scene lifecycle | Core / Stable |
| \`@mcthaydt/automata-render-pixi\` | PixiJS 2D renderer, entity views, sub-tick interpolation | Core / Stable |
| \`@mcthaydt/automata-physics\` | 2D Rapier deterministic collision and rigidbodies | Core / Stable |
| \`@mcthaydt/automata-ui\` | Mobile touch primitives, geometry ownership | Core / Stable |
| \`@mcthaydt/automata-host\` | Ruken SDK bridge, persistent saves, lifecycle ports | Core / Stable |
| \`@mcthaydt/automata-content\` | Hot-reloading content compiler, asset schemas | Extension |`,
  },
  {
    id: 'quick-start',
    slug: 'quick-start',
    title: 'Quick Start',
    category: 'Getting Started',
    badge: 'Guide',
    description: 'Scaffold your first Automata game in seconds with npx automata.',
    content: `# Quick Start Guide

Start building deterministic browser games in seconds using the official CLI.

## Installation

\`\`\`bash
# Create a new Automata 2D game project
npx automata create-game my-game

# Enter project directory
cd my-game

# Install dependencies and start development server
pnpm install
pnpm dev
\`\`\`

## Project Anatomy

A standard Automata game project has three clean layers:

\`\`\`
my-game/
├── src/
│   ├── sim/             # Pure deterministic ECS logic (Koota)
│   │   ├── traits.ts    # Entity components & schemas
│   │   └── systems.ts   # Movement, combat, collisions
│   ├── render/          # PixiJS visual representation
│   │   └── views.ts     # Sprites, shaders, animations
│   └── main.ts          # Effect runtime bootloader & loop
└── package.json
\`\`\`

> [!TIP]
> The \`sim/\` folder never imports browser APIs, PixiJS, or Effect. This guarantees your game logic can run headless on a multiplayer game server or inside a test runner.`,
  },
  {
    id: 'sim-ecs',
    slug: 'sim-ecs',
    title: 'ECS Simulation & Determinism',
    category: 'Core Simulation',
    badge: 'M1',
    description: 'Fixed 60Hz timestep, Koota ECS traits, and bit-identical replays.',
    content: `# ECS Simulation & Determinism

The heart of Automata is a pure, deterministic simulation built on Koota ECS.

## Fixed Timestep Simulation Loop

The simulation advances in discrete, uniform steps of exactly 16.666ms (60 ticks per second):

\`\`\`typescript
import { createSim, defineTrait } from '@mcthaydt/automata-sim'

// Define traits as pure schemas
export const Position = defineTrait({ x: 0, y: 0 })
export const Velocity = defineTrait({ vx: 0, vy: 0 })

// Create sim instance
export const sim = createSim({
  fixedDeltaMs: 16.666,
  systems: [
    (world) => {
      // Query entities with Position and Velocity
      world.query(Position, Velocity).each(([pos, vel]) => {
        pos.x += vel.vx
        pos.y += vel.vy
      })
    }
  ]
})
\`\`\`

## Deterministic Verification

Every commit runs cross-engine replay testing across Chromium (V8), WebKit (JavaScriptCore), and Firefox (SpiderMonkey). A 500-tick run produces bit-identical XXH64 state hashes.`,
  },
  {
    id: 'render-pixi',
    slug: 'render-pixi',
    title: 'PixiJS 2D Presentation',
    category: 'Rendering',
    badge: 'PixiJS v8',
    description: 'Sub-tick alpha interpolation, entity views, and WebGL2/WebGPU shaders.',
    content: `# PixiJS 2D Presentation Boundary

Automata enforces a strict boundary between simulation state and visual rendering.

## Sub-Tick Alpha Interpolation

High refresh-rate monitors (120Hz, 144Hz, 240Hz) render faster than the 60Hz simulation. To avoid jitter, Automata calculates sub-tick alpha:

\`\`\`
alpha = accumulator / fixedDeltaMs
position_rendered = prev_pos * (1 - alpha) + current_pos * alpha
\`\`\`

\`\`\`typescript
import { createPixiRenderer, type EntityView } from '@mcthaydt/automata-render-pixi'

const playerView: EntityView = {
  container: playerSprite,
  update(curr, prev, alpha = 1) {
    const p = prev?.transform ?? curr?.transform
    const c = curr?.transform
    if (c && p) {
      playerSprite.x = p.x + (c.x - p.x) * alpha
      playerSprite.y = p.y + (c.y - p.y) * alpha
    }
  }
}
\`\`\`

> [!NOTE]
> PixiJS v8 automatically uses WebGPU when supported by the client device, falling back seamlessly to WebGL2.`,
  },
  {
    id: 'effect-runtime',
    slug: 'effect-runtime',
    title: 'Effect Runtime & Concurrency',
    category: 'Architecture',
    badge: 'Effect',
    description: 'Structured concurrency, typed errors, and automatic resource scoping.',
    content: `# Effect Runtime & Concurrency

Outside the simulation loop, everything is managed by Effect.

## Typed Error Boundaries

Rather than uncaught runtime exceptions crashing the game canvas, all failures are typed and handled:

\`\`\`typescript
import { Effect, Scope } from 'effect'
import { bootGame, type BootError } from '@mcthaydt/automata-runtime'

const program = Effect.gen(function* () {
  const scope = yield* Scope.make()
  const runtime = yield* bootGame({
    canvasId: '#game',
    manifestUrl: '/assets/manifest.json'
  })
  return runtime
}).pipe(
  Effect.catchTags({
    AssetLoadFailed: (err) => Effect.logError('Assets failed', err),
    WebGLContextLost: (err) => Effect.logWarning('Restoring context', err)
  })
)
\`\`\`

## Resource Scoping

Textures, audio streams, and event listeners are automatically cleaned up when game rooms exit, eliminating memory leaks.`,
  },
  {
    id: 'security-csp',
    slug: 'security-csp',
    title: 'Zero-Eval CSP & Ruken Security',
    category: 'Security',
    badge: 'CSP Safe',
    description: 'Running games under strict Content Security Policy without eval or new Function.',
    content: `# Zero-Eval CSP & Ruken Security

Games on the Ruken platform execute inside an isolated iframe with a zero-trust Content Security Policy:

\`\`\`http
script-src 'self'; object-src 'none'; base-uri 'none';
\`\`\`

> [!WARNING]
> Most game engines rely on \`new Function\` or \`eval\` to compile shaders, schemas, or accessor expressions. Under Ruken, this throws an immediate \`EvalError\` and terminates execution.

## The Automata Solution

- **No-Eval Shader Programs:** Shaders are linked statically via \`@mcthaydt/automata-render-pixi/no-eval\`.
- **Precompiled Accessors:** Koota ECS accessors use array structs without dynamic code generation.
- **Zod Ahead-Of-Time Validation:** Schemas validate without JIT code generation.`,
  },
  {
    id: 'mobile-ui',
    slug: 'mobile-ui',
    title: 'Mobile UI Primitives',
    category: 'UI Primitives',
    badge: 'Mobile First',
    description: 'Responsive geometry ownership, safe areas, and touch controls.',
    content: `# Mobile UI Primitives

Automata UI is mobile-first, designed for phones, tablets, and handheld devices.

## Geometry Ownership & Reachability

The geometry owner handles viewport scaling, virtual safe areas, and touch zones:

\`\`\`typescript
import { createGeometryOwner } from '@mcthaydt/automata-ui'

const geometry = createGeometryOwner({
  window,
  root: document.documentElement,
  referenceWidth: 320,
  referenceHeight: 192
})
\`\`\`

## Virtual Controls

Touch joysticks and virtual buttons respond to multitouch without interfering with browser gestures.`,
  },
  {
    id: 'ai-rules',
    slug: 'ai-rules',
    title: 'AI Coding Agent Rules',
    category: 'AI & Skills',
    badge: 'LLMs',
    description: 'Official rules, constraints, and guardrails for AI coding assistants.',
    content: `# AI Coding Agent Rules & Guidelines

When generating code for Automata Framework games, AI coding assistants (Claude Code, Cursor, Windsurf, Copilot, Antigravity) MUST obey the 5 Golden Rules.

## The 5 Golden Rules for LLMs

1. **Simulation is Pure and Deterministic:**
   - NEVER import \`effect\`, browser DOM, \`window\`, \`document\`, or PixiJS inside \`packages/sim\` or game simulation files.
   - Simulation logic must run synchronously and deterministically.
2. **Effect Outside the Sim:**
   - Side effects (file saving, networking, audio, timer intervals) belong strictly in the runtime layer using Effect.
3. **Zero Eval:**
   - NEVER generate \`eval()\`, \`new Function()\`, or dynamic code evaluation. It violates Ruken's strict CSP (\`script-src 'self'\`).
4. **Sub-Tick Alpha Interpolation:**
   - Entity views must interpolate positions between previous and current ticks:
   \`\`\`typescript
   x_render = prev.x + (curr.x - prev.x) * alpha
   \`\`\`
5. **Single State Ownership:**
   - Only simulation systems mutate entity components. Presentation only observes \`RenderDelta\`.`,
  },
]

export function syncDocs() {
  const docs: DocSection[] = []

  for (const item of DEFAULT_DOCS) {
    let content = item.content
    // If overview file exists in monorepo, try reading
    if (item.slug === 'overview' && existsSync(frameworkDocsDir)) {
      try {
        const overviewPath = join(frameworkDocsDir, '00-overview.md')
        if (existsSync(overviewPath)) {
          content = readFileSync(overviewPath, 'utf-8')
        }
      } catch (_e) {
        // Fallback
      }
    }

    const toc = extractToc(content)
    docs.push({
      ...item,
      content,
      toc,
    })
  }

  // 1. Write src/data/docs.json
  const dataDir = join(websiteDir, 'src/data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  writeFileSync(join(dataDir, 'docs.json'), JSON.stringify(docs, null, 2))

  // 2. Generate static/llms.txt
  const staticDir = join(websiteDir, 'static')
  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true })
  }

  const llmsIndex = `# Automata Framework

> Automata is a deterministic 2D game framework built for modern web browsers and the Ruken gaming platform.

## Documentation
${docs.map((d) => `- [${d.title}](/docs/${d.slug}): ${d.description}`).join('\n')}

## AI & Agent Skills
- [Automata AI Portal](/ai): Official skills, agent install commands, and prompt templates.
- [Full Text Docs](/llms-full.txt): Complete plain-text documentation for LLMs.
`
  writeFileSync(join(staticDir, 'llms.txt'), llmsIndex.trim() + '\n')

  // 3. Generate static/llms-full.txt
  const llmsFull = `# Automata Framework — Full Documentation for LLMs

> Automata is a deterministic 2D game framework for the modern web and Ruken platform.
> Strict Core Laws: Koota ECS determinism, Effect outside sim, Zero Eval CSP, PixiJS 2D sub-tick alpha interpolation.

---

# The 5 Golden Rules for LLMs
1. Simulation is Pure and Deterministic: NEVER import Effect, browser DOM, or PixiJS inside simulation systems.
2. Effect Outside the Sim: Side effects (I/O, audio, network, saves) run in Effect outside the sim.
3. Zero Eval: Never use eval() or new Function(). Strict CSP compliance required.
4. Sub-tick alpha interpolation: Presentation interpolates positions between ticks: prev.x + (curr.x - prev.x) * alpha.
5. Single State Ownership: Only the sim mutates game entities; UI and presentation only observe truth.

---

${docs
  .map(
    (d) => `## Document: ${d.title} (${d.category})
URL: /docs/${d.slug}
Description: ${d.description}

${d.content}`
  )
  .join('\n\n---\n\n')}
`
  writeFileSync(join(staticDir, 'llms-full.txt'), llmsFull.trim() + '\n')

  return docs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncDocs()
  console.log('Successfully synced docs to src/data/docs.json, static/llms.txt, and static/llms-full.txt')
}
