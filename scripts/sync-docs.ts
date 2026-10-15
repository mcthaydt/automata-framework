import { STARTER_CODE } from '../src/data/starter'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
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
    "id": "overview",
    "slug": "overview",
    "title": "Overview & Vision",
    "category": "Getting Started",
    "description": "The architecture and current developer-preview scope.",
    "content": "# Overview & Vision\n\nAutomata is a TypeScript game framework for modern web browsers and Ruken, the reference gaming host.\n\n> [!NOTE]\n> This is a developer preview. The bundled examples demonstrate current behavior; a roadmap describes planned work, not shipped features.\n\n## Ownership\n\nOnly simulation systems change gameplay state during a run. Input sends commands. PixiJS reads render deltas. Effect manages resources and side effects outside the simulation.\n\n## Current starting point\n\nExplore the 2D starter and focused examples before adding your own systems. The Last Light and FloorFifty are reference projects that informed the architecture.\n\n## Packages\n\n| Package | Responsibility |\n|---|---|\n| @mcthaydt/automata-sim | Simulation, definitions, snapshots and RNG |\n| @mcthaydt/automata-runtime | Boot, flow and scoped runtime |\n| @mcthaydt/automata-render-pixi | PixiJS presentation |\n| @mcthaydt/automata-physics/2d | Deterministic 2D physics |\n| @mcthaydt/automata-ui | Responsive geometry and UI |\n| @mcthaydt/automata-host | Hosting sessions |\n| @mcthaydt/automata-content | Content validation and compilation |"
  },
  {
    "id": "quick-start",
    "slug": "quick-start",
    "title": "Quick Start",
    "category": "Getting Started",
    "description": "Access prerequisites and a local example workflow.",
    "content": "# Quick Start\n\n## Before you start\n\nYou need access to the framework repository and its private dependencies. Packages use the @mcthaydt scope on GitHub Packages. Follow the repository's current authentication instructions; never put access tokens in source files or prompts.\n\nThere is no verified public unscoped npx installer documented here. Use the checked-out repository as the source of truth.\n\n## Run an example\n\nFrom an authorized checkout, use Node 24 and the repository's package manager. Install dependencies, then run the renderer example:\n\n```sh\npnpm install\npnpm --filter @af-examples/renderer-2d dev\n```\n\n## Learn the simulation\n\nThe following example creates a headless simulation. Rendering and hosting are separate responsibilities.\n\nSTARTER_PLACEHOLDER\n\n## Next steps\n\nRead ECS Simulation & Determinism, then inspect the examples gallery for input, presentation and hosting flows."
  },
  {
    "id": "sim-ecs",
    "slug": "sim-ecs",
    "title": "ECS Simulation & Determinism",
    "category": "Core",
    "description": "Components, systems, async creation and synchronous stepping.",
    "content": "# ECS Simulation & Determinism\n\n## Definitions\n\nUse defineComponent for fields, defineSystem for a synchronous run function, and definePlugin to register components and systems. Systems query entities through SimContext and write through entity.set.\n\n## Creation and ticks\n\nAwait createSim with a seed and plugins. Creation can initialize plugin engines asynchronously. Once created, sim.step(commands) advances one fixed tick synchronously. The default tick rate is 60 Hz.\n\n## Repeatable runs\n\nKeep I/O, wall-clock time, Math.random, DOM and Effect outside simulation steps. Use context RNG streams and the framework's deterministic math where required. Replay equivalence depends on matching code, content, initial state and commands; use the cross-engine checks for evidence.\n\n## Snapshots and lifetime\n\nUse sim.snapshot() to serialize state and sim.restore(bytes) to restore a compatible snapshot. Call sim.dispose() when the simulation is no longer needed."
  },
  {
    "id": "render-pixi",
    "slug": "render-pixi",
    "title": "PixiJS 2D Presentation",
    "category": "Core",
    "description": "Renderer setup, render deltas and interpolation.",
    "content": "# PixiJS 2D Presentation\n\n## Renderer setup\n\nImport @mcthaydt/automata-render-pixi/no-eval before initializing PixiJS. createPixiRenderer returns a factory that accepts the runtime render target and produces a scoped Effect.\n\nWebGL2 is the default. WebGPU is opt-in. Test the renderer you plan to ship on the devices you support.\n\n## Between ticks\n\nPresentation reads render deltas instead of changing gameplay state. Interpolate between previous and current values when drawing between simulation ticks.\n\n```ts\nsprite.x = previous.x + (current.x - previous.x) * alpha\n```\n\n## Working examples\n\nThe renderer example demonstrates presentation in isolation. Emberwick adds a playable room. Use those sources for the complete boot and disposal flow."
  },
  {
    "id": "effect-runtime",
    "slug": "effect-runtime",
    "title": "Effect Runtime & Concurrency",
    "category": "Core",
    "description": "Loading, errors and resource lifetimes outside the sim.",
    "content": "# Effect Runtime & Concurrency\n\n## Boot\n\nrunGame accepts a GameDefinition and returns a RuntimeHandle. It owns boot attempts, resources and shutdown. Use the runtime package types for the full definition.\n\n## Resource ownership\n\nEffect scopes manage resource lifetimes outside the simulation. Keep file and network access, loading, timers and persistent saves out of simulation systems.\n\n## Failure and recovery\n\nBoot failures are typed. Inspect the runtime example for its loading, retry and failure behavior. A typed boundary makes failure explicit; it does not guarantee a game cannot crash."
  },
  {
    "id": "security-csp",
    "slug": "security-csp",
    "title": "Zero-Eval CSP & Ruken Security",
    "category": "Core",
    "description": "Avoiding dynamic evaluation under the host policy.",
    "content": "# Zero-Eval CSP & Ruken Security\n\n## Dynamic evaluation\n\nDo not use eval or new Function in game code. Ruken does not permit unsafe-eval. Import the renderer's no-eval entry before initializing PixiJS.\n\n## Policy scope\n\nAvoiding dynamic evaluation is one part of CSP compatibility. Asset origins, connections, workers and other directives must also match the host policy. Test the built game under that actual policy.\n\n## Trust boundaries\n\nKeep credentials outside game bundles. Validate host messages at the integration boundary. Use the supported hosting API instead of inventing another handshake."
  },
  {
    "id": "mobile-ui",
    "slug": "mobile-ui",
    "title": "Mobile UI Primitives",
    "category": "Core",
    "description": "Geometry, controls and accessible layout.",
    "content": "# Mobile UI Primitives\n\n## Geometry\n\ncreateGeometryOwner tracks the space available to game UI, including host geometry and viewport changes. Use its state instead of independent measurements in every component.\n\n## Layout and controls\n\nScreenFrame, ActionBar, CornerControls and Dialog provide building blocks. Check their current Props definitions rather than guessing component inputs.\n\n## Device checks\n\nVerify touch targets, focus order, orientation changes, safe areas and keyboard occlusion on supported devices. A responsive layout test does not establish GPU performance or real-device acceptance."
  },
  {
    "id": "ai-rules",
    "slug": "ai-rules",
    "title": "AI Coding Agent Rules",
    "category": "Guidance",
    "description": "Project context for agents, followed by verification.",
    "content": "# AI Coding Agent Rules\n\n## Start from source\n\nGive the agent AGENTS.md, current package types and the nearest working example. Read instructions through the agent's supported project-context mechanism.\n\n## Boundaries\n\n- Only simulation systems mutate gameplay state during a run.\n- Effect runs outside the sim.\n- Avoid dynamic evaluation; verify the actual host CSP.\n- Presentation interpolates between ticks and observes render deltas.\n- Report the checks performed and the gates still open.\n\n## Verify the result\n\nInstructions cannot eliminate hallucinations or guarantee correct code. Check exported names, typecheck changes, run relevant tests and inspect runtime behavior.\n\n## Plain-text context\n\nThe website publishes llms.txt as an index and llms-full.txt as a combined text reference. They contain curated introductory documentation, not the complete framework source."
  }
]

export function syncDocs() {
  const docs: DocSection[] = []

  for (const item of DEFAULT_DOCS) {
    const content = item.content.replace('STARTER_PLACEHOLDER', '```typescript\n' + STARTER_CODE + '\n```')
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
- [Automata AI Portal](/ai): Project context, architectural rules, and verification guidance.
- [Full Text Docs](/llms-full.txt): Combined introductory documentation for coding agents.
`
  writeFileSync(join(staticDir, 'llms.txt'), llmsIndex.trim() + '\n')

  // 3. Generate static/llms-full.txt
  const llmsFull = `# Automata Framework — Introductory Documentation for Coding Agents

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
