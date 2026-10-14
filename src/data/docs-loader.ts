import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface DocSection {
  id: string
  slug: string
  title: string
  description: string
  content: string
}

const STATIC_DOCS: DocSection[] = [
  {
    id: 'overview',
    slug: 'overview',
    title: 'Overview & Vision',
    description: 'High-level architecture, design laws, and Ruken-first direction.',
    content: `# Overview & Vision

Automata Framework (AF) is a deterministic game framework designed for modern web browsers and the Ruken gaming platform.

## Core Laws
1. **Ruken first:** All framework primitives integrate natively with Ruken's SDK and strict security policies.
2. **Deterministic simulation:** The sim is synchronous, pure, and written with Koota ECS. It yields bit-identical hashes across Chromium, WebKit, and Firefox.
3. **Effect outside the sim:** All side effects (I/O, network, timers, lifecycles, and storage) run in Effect. The sim never imports Effect.
4. **Zero eval:** No \`new Function\` or \`eval\` anywhere, guaranteeing compliance with Ruken's strict CSP (\`script-src 'self'\`).
5. **PixiJS rendering:** PixiJS v8 powers both 2D (WebGL2/WebGPU) and 2.5D/3D rendering.`,
  },
  {
    id: 'sim-vs-presentation',
    slug: 'sim-vs-presentation',
    title: 'ECS Sim vs. Presentation',
    description: 'The strict separation between deterministic game logic and interpolated visuals.',
    content: `# ECS Sim vs. Presentation Boundary

Automata enforces a clean boundary between simulation state and visual representation.

## Simulation Layer
- Runs at a fixed 60Hz timestep.
- Built on Koota ECS.
- Does not know about pixels, DOM, WebGL, or window events.
- Produces a \`RenderDelta\` containing dirty entity positions and states.

## Presentation Layer
- Runs at whatever refresh rate the player's monitor supports (60Hz, 120Hz, 144Hz, 240Hz).
- Consumes \`RenderDelta\` via \`RenderDeltaConsumer\`.
- Computes sub-tick alpha interpolation (\`alpha = accumulator / dt\`) for buttery smooth motion.
- Renders via PixiJS.`,
  },
  {
    id: 'effect-boundaries',
    slug: 'effect-boundaries',
    title: 'Effect Runtime & Error Boundaries',
    description: 'How structured concurrency, typed errors, and scopes prevent game crashes.',
    content: `# Effect Runtime & Error Boundaries

Everything outside the simulation loop runs as an Effect service.

## Why Effect?
- **Typed Errors:** Boot errors, asset load failures, and host disconnections are represented as explicit TypeScript unions (\`BootError\`, \`AssetLoadFailed\`, \`HostHandshakeFailed\`). Every error has a dedicated recovery UI.
- **Resource Scoping:** When navigating between screens or restarting a game, Effect's \`Scope\` automatically disposes textures, event listeners, and audio handles.
- **Structured Concurrency:** Background tasks (like asset streaming or save flushing) are supervised fibers that cancel cleanly on exit.`,
  },
  {
    id: 'no-eval-csp',
    slug: 'no-eval-csp',
    title: 'No-Eval CSP & Ruken Rules',
    description: 'Ensuring 100% compliance with strict Content Security Policy without compromising performance.',
    content: `# No-Eval CSP & Ruken Rules

Ruken executes games inside an iframe with a zero-trust Content Security Policy:
\`\`\`http
script-src 'self'; object-src 'none'; base-uri 'none';
\`\`\`

## The Challenge
Most JavaScript game engines rely on dynamic code generation (\`new Function\` or \`eval\`) to compile ECS accessors or shader programs. Under Ruken, this throws an immediate \`EvalError\`.

## The Automata Solution
- **Koota Array-of-Structs:** Traits are defined as factory functions rather than dynamic code-generated accessors.
- **PixiJS No-Eval Entry:** Automata imports \`@mcthaydt/automata-render-pixi/no-eval\`, which utilizes static WebGL program linkers and JIT-less Zod validators.
- **CI Enforcement:** Automated Playwright test runs verify that the entire bundle loads with zero CSP violation reports.`,
  },
  {
    id: 'how-we-build',
    slug: 'how-we-build',
    title: 'How We Build & Test Parity',
    description: 'Cross-engine test automation, golden replay testing, and Changesets versioning.',
    content: `# How We Build & Test Parity

Automata employs an uncompromising testing harness:

## 1. Cross-Engine Parity Gate
Every commit runs automated headless browser checks across three distinct browser engines:
- Chromium (V8)
- WebKit (JavaScriptCore)
- Firefox (SpiderMonkey)

A golden hash gate verifies that a 500-tick simulation run produces the exact same XXH64 hash across all three engines down to the last bit.

## 2. Boundary Verification
AST static analysis (\`check-boundaries\`) verifies that no file inside \`packages/sim\` ever imports Effect or external I/O.`,
  },
]

export function getDocSections(): DocSection[] {
  // Try reading from monorepo if available
  const frameworkDocsDir = resolve(process.cwd(), '../automata-framework/docs')
  if (existsSync(frameworkDocsDir)) {
    try {
      const overviewPath = join(frameworkDocsDir, '00-overview.md')
      if (existsSync(overviewPath)) {
        const raw = readFileSync(overviewPath, 'utf-8')
        STATIC_DOCS[0].content = raw
      }
    } catch (_e) {
      // Fallback to static
    }
  }
  return STATIC_DOCS
}

export function getDocBySlug(slug: string): DocSection | undefined {
  return STATIC_DOCS.find((s) => s.slug === slug || s.id === slug)
}
