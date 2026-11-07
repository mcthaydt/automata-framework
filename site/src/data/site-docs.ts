import type { Guide } from '../shared/framework/guides'
import { PIXIJS_INSTALL, SKILL_PREFLIGHT, SKILL_SOURCES } from './agent-setup'
import { AUDIENCE_FIT, AUDIENCE_NOT_FIT, FAQ_ITEMS } from './audience'
import { PLUS_DOC, SAVES_DOC, SERVICE_MODEL_DOC } from './deep-docs'
import { MIGRATION_GUIDES } from './migrations'
import { DISTRIBUTION_TARGETS } from './targets'

// The docs pages: the site's own pages first, then the framework's guides (docs/guides/*.md, read at build time by
// src/shared/framework/guides.ts).

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

const AUTHORED_DOCS: Omit<DocSection, 'toc'>[] = [
  {
    id: 'overview',
    slug: 'overview',
    title: 'Overview & Vision',
    category: 'Getting Started',
    description: 'AI-assisted game development with code and content you can own.',
    content:
      '# Overview & Vision\n\nAutomata is a TypeScript game framework for the web. ' +
      DISTRIBUTION_TARGETS +
      '\n\nAutomata is designed for developers using coding agents: agents write code and tests; people direct the game and author its content. Start with a working example, make a bounded change, and review the result.\n\n## License\n\n> [!NOTE]\n> Framework code is MIT licensed. Third-party dependencies and example artwork retain their own stated terms. See the repository license and asset provenance before redistributing assets.\n\n## Ownership\n\nOnly simulation systems change gameplay state during a run. Input sends commands. PixiJS reads render deltas. Effect manages resources and side effects outside the simulation.\n\n## Current starting point\n\nExplore the 2D starter and focused examples before adding your own systems.\n\n## Packages\n\n| Package | Responsibility |\n|---|---|\n| @mcthaydt/automata-sim | Simulation, definitions, snapshots and RNG |\n| @mcthaydt/automata-runtime | Boot, flow and scoped runtime |\n| @mcthaydt/automata-render-pixi | PixiJS presentation |\n| @mcthaydt/automata-ui | Responsive geometry and UI |\n| @mcthaydt/automata-host | Hosting sessions |\n| @mcthaydt/automata-content | Content validation and compilation |',
  },
  {
    id: 'quick-start',
    slug: 'quick-start',
    title: 'Quick Start',
    category: 'Getting Started',
    description: 'Play a double-jump remix, copy a task, and run the starter on your machine.',
    content:
      '# Quick Start\n\nYou need Node 24 and pnpm. Four commands make a game, play it, draw its level and put it online.\n\n## Make a game\n\n```sh\nnpx @mcthaydt/automata-tools create-game my-game\n```\n\nA folder called my-game with a small working platformer in it: a level, a player and its tests.\n\n## Play it\n\n```sh\ncd my-game && pnpm install && pnpm dev\n```\n\nThe game opens in your browser and updates while you play when a file changes.\n\n## Draw its level\n\n```sh\npnpm exec automata editor\n```\n\nThe level editor opens on your game. Draw, press Save, and the running game picks up the change. [Draw levels in the editor](/docs/editor) says more.\n\n## Put it online\n\n```sh\npnpm build:web && pnpm prepare:web\n```\n\nA checked build in dist/, ready for any static host. [itch.io](/docs/publish-to-itch), [a desktop app](/docs/publish-to-desktop) and [Ruken](/docs/publish-to-ruken) have their own guides.\n\n## Use a coding agent\n\n[Install agent skills](/docs/agent-setup) once, then ask your agent for one change at a time: it edits the files, runs the tests and tells you what to try.\n',
  },
  {
    id: 'sim-ecs',
    slug: 'sim-ecs',
    title: 'ECS Simulation & Determinism',
    category: 'Core',
    description: 'Components, systems, async creation and synchronous stepping.',
    content:
      "# ECS Simulation & Determinism\n\n## Definitions\n\nUse defineComponent for fields, defineSystem for a synchronous run function, and definePlugin to register components and systems. Systems query entities through SimContext and write through entity.set.\n\n## Creation and ticks\n\nAwait createSim with a seed and plugins. Creation can initialize plugin engines asynchronously. Once created, sim.step(commands) advances one fixed tick synchronously. The default tick rate is 60 Hz.\n\n## Repeatable runs\n\nKeep I/O, wall-clock time, Math.random, DOM and Effect outside simulation steps. Use context RNG streams and the framework's deterministic math where required. Replay equivalence depends on matching code, content, initial state and commands; use the cross-engine checks for evidence.\n\n## Snapshots and lifetime\n\nUse sim.snapshot() to serialize state and sim.restore(bytes) to restore a compatible snapshot. Call sim.dispose() when the simulation is no longer needed.",
  },
  {
    id: 'render-pixi',
    slug: 'render-pixi',
    title: 'PixiJS 2D Presentation',
    category: 'Core',
    description: 'Renderer setup, render deltas and interpolation.',
    content:
      '# PixiJS 2D Presentation\n\n## Renderer setup\n\nImport @mcthaydt/automata-render-pixi/no-eval before initializing PixiJS. createPixiRenderer returns a factory that accepts the runtime render target and produces a scoped Effect.\n\nWebGL2 is the default. WebGPU is opt-in. Test the renderer you plan to ship on the devices you support.\n\n## Between ticks\n\nPresentation reads render deltas instead of changing gameplay state. Interpolate between previous and current values when drawing between simulation ticks.\n\n```ts\nsprite.x = previous.x + (current.x - previous.x) * alpha\n```\n\n## Working examples\n\nThe renderer example demonstrates presentation in isolation. Emberwick adds a playable room. Use those sources for the complete boot and disposal flow.',
  },
  {
    id: 'effect-runtime',
    slug: 'effect-runtime',
    title: 'Effect Runtime & Concurrency',
    category: 'Core',
    description: 'Loading, errors and resource lifetimes outside the sim.',
    content:
      '# Effect Runtime & Concurrency\n\n## Boot\n\nrunGame accepts a GameDefinition and returns a RuntimeHandle. It owns boot attempts, resources and shutdown. Use the runtime package types for the full definition.\n\n## Resource ownership\n\nEffect scopes manage resource lifetimes outside the simulation. Keep file and network access, loading, timers and persistent saves out of simulation systems.\n\n## Failure and recovery\n\nBoot failures are typed. Inspect the runtime example for its loading, retry and failure behavior. A typed boundary makes failure explicit; it does not guarantee a game cannot crash.',
  },
  {
    id: 'security-csp',
    slug: 'security-csp',
    title: 'Zero-Eval CSP & Host Security',
    category: 'Core',
    description: 'Avoiding dynamic evaluation under the host policy.',
    content:
      "# Zero-Eval CSP & Host Security\n\n## Dynamic evaluation\n\nDo not use eval or new Function in game code. Every web build follows the no-eval rule, whatever its target. Import the renderer's no-eval entry before initializing PixiJS.\n\n## Policy scope\n\nAvoiding dynamic evaluation is one part of CSP compatibility. Asset origins, connections, workers and other directives must also match the host policy. Test the built game under the headers its target serves. On Ruken, a game's headers come from compileHeaders in @ruken/manifest, and the framework CLI's CSP probe loads the build in Chromium under them.\n\n## Trust boundaries\n\nKeep credentials outside game bundles. Validate host messages at the integration boundary. Use the supported hosting API instead of inventing another handshake.",
  },
  {
    id: 'mobile-ui',
    slug: 'mobile-ui',
    title: 'Mobile UI Primitives',
    category: 'Core',
    description: 'Geometry, controls and accessible layout.',
    content:
      '# Mobile UI Primitives\n\n## Geometry\n\ncreateGeometryOwner tracks the space available to game UI, including host geometry and viewport changes. Use its state instead of independent measurements in every component.\n\n## Layout and controls\n\nScreenFrame, ActionBar, CornerControls and Dialog provide building blocks. Check their current Props definitions rather than guessing component inputs.\n\n## Device checks\n\nVerify touch targets, focus order, orientation changes, safe areas and keyboard occlusion on supported devices. A responsive layout test does not establish GPU performance or real-device acceptance.\n\n## Tested input journeys\n\nAt 780×270, the framework’s input matrix plays a touch journey and a gamepad journey in Chromium under a fake host. Keyboard journeys run at the tablet and desktop sizes, in Chromium, WebKit and Firefox at desktop size. These are browser tests with simulated input and DOM geometry. Acceptance on real phones and controllers is separate and still open. [Read the matrix](https://github.com/mcthaydt/automata-framework/blob/main/packages/tools/src/e2e/input-matrix.ts).\n',
  },
  {
    id: 'ai-rules',
    slug: 'ai-rules',
    title: 'AI Coding Agent Rules',
    category: 'Guidance',
    description: 'Project context for agents, followed by verification.',
    content:
      "# AI Coding Agent Rules\n\n## Start from source\n\nInstall Superpowers and the official PixiJS v8 skills, then have the agent report which guidance it loaded. See [Install agent skills](/docs/agent-setup). Give the agent AGENTS.md, current package types and the nearest working example. Read instructions through the agent's supported project-context mechanism.\n\n## Boundaries\n\n- Only simulation systems mutate gameplay state during a run.\n- Effect runs outside the sim.\n- Avoid dynamic evaluation; verify the actual host CSP.\n- Presentation interpolates between ticks and observes render deltas.\n- Report the checks performed and the gates still open.\n\n## Verify the result\n\nInstructions cannot eliminate hallucinations or guarantee correct code. Check exported names, typecheck changes, run relevant tests and inspect runtime behavior.\n\n## Plain-text context\n\nThe website publishes llms.txt as an index; llms-full.txt, the framework's defined documentation corpus followed by its complete API reference, and llms-api.txt, that reference alone, both generated from the package declarations by the framework's API index; and llms-guides.txt, this site's guides and task prompts. None of them is the framework source.",
  },
  {
    id: 'capabilities',
    slug: 'capabilities',
    title: 'Capabilities and licensing',
    category: 'Getting Started',
    description: 'What you can use today, what is planned, and how the license applies.',
    content:
      '# Capabilities and licensing\n\n## Available foundations\n\n- Browser games with a playable 2D starter and standalone delivery.\n- Phone-first interface primitives, keyboard and touch input examples.\n- Simulation systems, seeded randomness, snapshots and replays.\n- Explicit source files and tests that people and coding agents can inspect and change.\n\n## Where a game goes\n\n' +
      DISTRIBUTION_TARGETS +
      " A game chooses its target when it is built.\n\n## Planned\n\nMultiplayer networking and server packages are planned. Deterministic simulation and replays are foundations for that work, not a complete multiplayer service. Full 3D support and further gameplay extensions follow the framework roadmap.\n\n## MIT framework code\n\nThe framework code uses the MIT license. You may use it in commercial games and modify it without publishing your game's source, subject to retaining the required license notice. Read the repository's LICENSE for the full terms.\n\n## Assets and extensions\n\nThe framework license does not replace third-party dependency licenses or asset-specific terms. Example art has provenance files in its project; fonts have their own licenses. Any extension sold under separate terms must state those terms explicitly.\n",
  },
]

const migrationDocs: Omit<DocSection, 'toc'>[] = MIGRATION_GUIDES.map((guide) => ({
  id: guide.slug,
  slug: guide.slug,
  title: 'From ' + guide.engine,
  category: 'Coming from another engine',
  description: guide.description,
  content:
    '# From ' +
    guide.engine +
    '\n\n' +
    guide.introduction +
    '\n\n## Map familiar concepts\n\n| Your starting point | Automata responsibility |\n|---|---|\n' +
    guide.mappings.map(([from, to]) => '| ' + from + ' | ' + to + ' |').join('\n') +
    '\n\n## The habit to change\n\n' +
    guide.habit +
    '\n\n## Your first small port\n\n' +
    guide.task +
    '\n\n[Open Emberwick’s source](/examples?demo=base-2d) and [make your first game](/start).\n\n## Compatibility and scope\n\n' +
    guide.caution +
    '\n\n[Current capabilities](/docs/capabilities).',
}))
AUTHORED_DOCS.splice(2, 0, ...migrationDocs)
AUTHORED_DOCS.push(SERVICE_MODEL_DOC, SAVES_DOC, PLUS_DOC)
AUTHORED_DOCS.push(
  {
    id: 'agent-setup',
    slug: 'agent-setup',
    title: 'Install agent skills',
    category: 'Getting Started',
    description:
      'Install Superpowers and the official PixiJS collection, then verify the agent can load them.',
    content:
      '# Install agent skills\n\n## Required for the guided AI workflow\n\nInstall Superpowers and the official PixiJS v8 skill collection for the agent you will use. They guide planning, testing and rendering work; they are not runtime dependencies of the game.\n\n## Install Superpowers\n\nIn the Codex app, open Plugins and install Superpowers. In Codex CLI, use /plugins, search for Superpowers and select Install Plugin.\n\nIn Claude Code, use its official plugin marketplace:\n\n```text\n/plugin install superpowers@claude-plugins-official\n```\n\nIn Cursor Agent chat:\n\n```text\n/add-plugin superpowers\n```\n\nOther agents have their own installation routes. Use the [upstream Superpowers instructions](' +
      SKILL_SOURCES.superpowers +
      ').\n\n## Install PixiJS skills\n\nRun this in the checkout and follow the prompts for your coding agent and the full PixiJS collection:\n\n```sh\n' +
      PIXIJS_INSTALL +
      '\n```\n\nSee the [official PixiJS instructions](' +
      SKILL_SOURCES.pixijs +
      ').\n\n## Verify before coding\n\nAsk the agent to confirm installed and loaded skills, rather than inferring readiness from a website checkbox.\n\n```text\n' +
      SKILL_PREFLIGHT +
      '\n```\n\n[Use the interactive setup checklist](/start). Installation sources were checked on 15 October 2026; follow upstream instructions when a tool changes.',
  },
  {
    id: 'audience',
    slug: 'audience',
    title: 'Who Automata is for',
    category: 'Getting Started',
    description: 'Choose Automata based on your workflow and current requirements.',
    content:
      '# Who Automata is for\n\n## Who this is for\n\n' +
      AUDIENCE_FIT.map((item) => '- ' + item).join('\n') +
      '\n\n## Who this is not for\n\n' +
      AUDIENCE_NOT_FIT.map((item) => '- ' + item).join('\n') +
      '\n\n## Start from your background\n\n' +
      MIGRATION_GUIDES.map((guide) => '- [From ' + guide.engine + '](/docs/' + guide.slug + ')').join('\n') +
      '\n\n[Current capabilities and licensing](/docs/capabilities).',
  },
  {
    id: 'faq',
    slug: 'faq',
    title: 'FAQ',
    category: 'Getting Started',
    description: 'Answers about agents, content, licensing, platforms, migration and community games.',
    content:
      '# FAQ\n\n' +
      FAQ_ITEMS.map((item) => '## ' + item.question + '\n\n' + item.answer).join('\n\n') +
      '\n\n[Install agent skills](/docs/agent-setup) or [make a first change](/start).',
  },
)

/** Every docs page, in the order the docs index lists them. */
export function buildDocs(guides: readonly Guide[]): DocSection[] {
  const guideDocs = guides.map((guide) => ({
    id: guide.slug,
    slug: guide.slug,
    title: guide.title,
    category: 'Guides',
    description: guide.description,
    content: `# ${guide.title}\n\n${guide.content}`,
  }))
  return [...AUTHORED_DOCS, ...guideDocs].map((doc) => ({ ...doc, toc: extractToc(doc.content) }))
}
