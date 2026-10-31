import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readGuides } from './sync-guides'
import { MIGRATION_GUIDES } from '../src/data/migrations'
import { AUDIENCE_FIT, AUDIENCE_NOT_FIT, FAQ_ITEMS } from '../src/data/audience'
import { SKILL_PREFLIGHT, PIXIJS_INSTALL, SKILL_SOURCES } from '../src/data/agent-setup'
import { CHEATSHEET_MODULES } from '../src/data/cheatsheet'
import { DISTRIBUTION_TARGETS } from '../src/data/targets'
import { AI_CONTEXT_FILES, AI_PROJECT_PROMPT, AI_RULES, AI_TASKS, AI_REVIEW_CHECKS, AI_VERIFY_COMMANDS } from '../src/data/ai-guidance'

const __dirname = dirname(fileURLToPath(import.meta.url))
const websiteDir = resolve(__dirname, '..')
const apiIndex = JSON.parse(readFileSync(join(websiteDir, 'src/data/api-index.json'), 'utf8')) as { commit: string; version: string }
// The runtime's BootError union and its members, as the framework's API index documents them (scripts/sync-api-index.ts).
const bootErrors = JSON.parse(readFileSync(join(websiteDir, 'src/data/boot-errors.json'), 'utf8')) as { commit: string; signature: string; doc: string; members: { name: string; package: string; doc: string }[] }

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
    "description": "AI-assisted game development with code and content you can own.",
    "content": "# Overview & Vision\n\nAutomata is a TypeScript game framework for the web. " + DISTRIBUTION_TARGETS + "\n\nAutomata is designed for developers using coding agents: agents write code and tests; people direct the game and author its content. Start with a working example, make a bounded change, and review the result.\n\n## License\n\n> [!NOTE]\n> Framework code is MIT licensed. Third-party dependencies and example artwork retain their own stated terms. See the repository license and asset provenance before redistributing assets.\n\n## Ownership\n\nOnly simulation systems change gameplay state during a run. Input sends commands. PixiJS reads render deltas. Effect manages resources and side effects outside the simulation.\n\n## Current starting point\n\nExplore the 2D starter and focused examples before adding your own systems.\n\n## Packages\n\n| Package | Responsibility |\n|---|---|\n| @mcthaydt/automata-sim | Simulation, definitions, snapshots and RNG |\n| @mcthaydt/automata-runtime | Boot, flow and scoped runtime |\n| @mcthaydt/automata-render-pixi | PixiJS presentation |\n| @mcthaydt/automata-ui | Responsive geometry and UI |\n| @mcthaydt/automata-host | Hosting sessions |\n| @mcthaydt/automata-content | Content validation and compilation |"
  },
  {
    "id": "quick-start",
    "slug": "quick-start",
    "title": "Quick Start",
    "category": "Getting Started",
    "description": "Play a double-jump remix, copy a task, and run the starter on your machine.",
    "content": "# Quick Start\n\n## Play before setup\n\n[Try the double-jump remix](/start#worked-change) in your browser. Jump, release, and press again before landing. Toggle the extra jump off to compare the original. The same page includes the prompt, source, and tests.\n\n## Run the starter locally\n\nUse Node 24.21.0 or newer and pnpm 10.34.6.\n\n```sh\ngit clone https://github.com/mcthaydt/automata-framework.git\ncd automata-framework\npnpm install --frozen-lockfile\npnpm --filter @af-examples/base-2d dev\n```\n\nOpen the URL printed by Vite and play Emberwick. The starter is a working TypeScript browser game that you can edit directly or with a coding agent.\n\n## Give your agent one idea\n\n[Copy the double-jump task](/start#first-task). It adds one extra jump through a plugin, reuses the existing player input and movement definitions, and tests held input, landing, and snapshots. [Install agent skills](/docs/agent-setup) for the guided workflow when you set up your agent.\n\nA configurable player start is also included as a smaller content exercise. Its helper uses parseRoom to validate the new room while keeping the source content unchanged.\n\n## Check and play the result\n\n```sh\npnpm --filter @af-examples/base-2d check\npnpm --filter @af-examples/base-2d build\n```\n\nTry the new behavior and the original controls yourself. Ask the agent to report the files changed, the checks it ran, and any browser or device behavior it has not verified.\n\n## Choose your next change\n\n[Choose a task prompt](/ai#task-prompts) for a collectible, dash, jump feedback, room content, saves, or release preparation. The [API reference](/cheatsheet) provides examples and current package entry points.\n\n## License and scope\n\nFramework code is MIT licensed; assets and third-party dependencies retain their own terms. Browser and mobile foundations are available. Networking and server packages remain planned. See [capabilities and licensing](/docs/capabilities).\n"
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
    "title": "Zero-Eval CSP & Host Security",
    "category": "Core",
    "description": "Avoiding dynamic evaluation under the host policy.",
    "content": "# Zero-Eval CSP & Host Security\n\n## Dynamic evaluation\n\nDo not use eval or new Function in game code. Every web build follows the no-eval rule, whatever its target. Import the renderer's no-eval entry before initializing PixiJS.\n\n## Policy scope\n\nAvoiding dynamic evaluation is one part of CSP compatibility. Asset origins, connections, workers and other directives must also match the host policy. Test the built game under the headers its target serves. On Ruken, a game's headers come from compileHeaders in @ruken/manifest, and the framework CLI's CSP probe loads the build in Chromium under them. See [the content security policy](/ai#csp).\n\n## Trust boundaries\n\nKeep credentials outside game bundles. Validate host messages at the integration boundary. Use the supported hosting API instead of inventing another handshake."
  },
  {
    "id": "mobile-ui",
    "slug": "mobile-ui",
    "title": "Mobile UI Primitives",
    "category": "Core",
    "description": "Geometry, controls and accessible layout.",
    "content": "# Mobile UI Primitives\n\n## Geometry\n\ncreateGeometryOwner tracks the space available to game UI, including host geometry and viewport changes. Use its state instead of independent measurements in every component.\n\n## Layout and controls\n\nScreenFrame, ActionBar, CornerControls and Dialog provide building blocks. Check their current Props definitions rather than guessing component inputs.\n\n## Device checks\n\nVerify touch targets, focus order, orientation changes, safe areas and keyboard occlusion on supported devices. A responsive layout test does not establish GPU performance or real-device acceptance.\n\n## Tested input journeys\n\nAt 780×270, the framework’s input matrix plays a touch journey and a gamepad journey in Chromium under a fake host. Keyboard journeys run at the tablet and desktop sizes, in Chromium, WebKit and Firefox at desktop size. These are browser tests with simulated input and DOM geometry. Acceptance on real phones and controllers is separate and still open. [Read the matrix](https://github.com/mcthaydt/automata-framework/blob/" + apiIndex.commit + "/packages/testing/src/e2e/input-matrix.ts) at the framework commit this site was built from.\n"
  },
  {
    "id": "ai-rules",
    "slug": "ai-rules",
    "title": "AI Coding Agent Rules",
    "category": "Guidance",
    "description": "Project context for agents, followed by verification.",
    "content": "# AI Coding Agent Rules\n\n## Start from source\n\nInstall Superpowers and the official PixiJS v8 skills, then have the agent report which guidance it loaded. See [Install agent skills](/docs/agent-setup). Give the agent AGENTS.md, current package types and the nearest working example. Read instructions through the agent's supported project-context mechanism.\n\n## Boundaries\n\n- Only simulation systems mutate gameplay state during a run.\n- Effect runs outside the sim.\n- Avoid dynamic evaluation; verify the actual host CSP.\n- Presentation interpolates between ticks and observes render deltas.\n- Report the checks performed and the gates still open.\n\n## Verify the result\n\nInstructions cannot eliminate hallucinations or guarantee correct code. Check exported names, typecheck changes, run relevant tests and inspect runtime behavior.\n\n## Plain-text context\n\nThe website publishes llms.txt as an index; llms-full.txt, the framework's defined documentation corpus followed by its complete API reference, and llms-api.txt, that reference alone, both generated from the package declarations by the framework's API index; and llms-guides.txt, this site's guides and task prompts. None of them is the framework source."
  },
  {
    "id": "capabilities",
    "slug": "capabilities",
    "title": "Capabilities and licensing",
    "category": "Getting Started",
    "description": "What you can use today, what is planned, and how the license applies.",
    "content": "# Capabilities and licensing\n\n## Available foundations\n\n- Browser games with a playable 2D starter and standalone delivery.\n- Phone-first interface primitives, keyboard and touch input examples.\n- Simulation systems, seeded randomness, snapshots and replays.\n- Explicit source files and tests that people and coding agents can inspect and change.\n\n## Where a game goes\n\n" + DISTRIBUTION_TARGETS + " A game chooses its target when it is built.\n\n## Planned\n\nMultiplayer networking and server packages are planned. Deterministic simulation and replays are foundations for that work, not a complete multiplayer service. Full 3D support and further gameplay extensions follow the framework roadmap.\n\n## MIT framework code\n\nThe framework code uses the MIT license. You may use it in commercial games and modify it without publishing your game's source, subject to retaining the required license notice. Read the repository's LICENSE for the full terms.\n\n## Assets and extensions\n\nThe framework license does not replace third-party dependency licenses or asset-specific terms. Example art has provenance files in its project; fonts have their own licenses. Any extension sold under separate terms must state those terms explicitly.\n"
  }
]

const migrationDocs: Omit<DocSection, 'toc'>[] = MIGRATION_GUIDES.map(guide => ({
  id: guide.slug, slug: guide.slug, title: 'From ' + guide.engine, category: 'Coming from another engine', description: guide.description,
  content: '# From ' + guide.engine + '\n\n' + guide.introduction + '\n\n## Map familiar concepts\n\n| Your starting point | Automata responsibility |\n|---|---|\n' + guide.mappings.map(([from, to]) => '| ' + from + ' | ' + to + ' |').join('\n') + '\n\n## The habit to change\n\n' + guide.habit + '\n\n## Your first small port\n\n' + guide.task + '\n\n[Open Emberwick’s source](/examples?demo=base-2d) and [try the worked change](/start#worked-change).\n\n## Compatibility and scope\n\n' + guide.caution + '\n\n[Current capabilities](/docs/capabilities).',
}))
DEFAULT_DOCS.splice(2, 0, ...migrationDocs)
DEFAULT_DOCS.push({
  id: 'boot-errors', slug: 'boot-errors', title: 'Boot errors', category: 'Core', description: 'The typed failures boot reports, generated from the framework API index.',
  content: '# Boot errors\n\n' + bootErrors.doc + '\n\n```ts\n' + bootErrors.signature + '\n```\n\nThese are the failures boot reports as typed values. A defect in game code after boot is not one of them, and this list is not a claim that every failure is caught. [Read the source](https://github.com/mcthaydt/automata-framework/blob/' + bootErrors.commit + '/packages/runtime/src/boot/boot-error.ts) at the framework commit this site was built from.\n\n## The failures\n\n' + bootErrors.members.map(member => '### ' + member.name + '\n\nFrom `' + member.package + '`. ' + member.doc).join('\n\n') + '\n',
})
DEFAULT_DOCS.push(
  { id: 'agent-setup', slug: 'agent-setup', title: 'Install agent skills', category: 'Getting Started', description: 'Install Superpowers and the official PixiJS collection, then verify the agent can load them.', content: '# Install agent skills\n\n## Required for the guided AI workflow\n\nInstall Superpowers and the official PixiJS v8 skill collection for the agent you will use. They guide planning, testing and rendering work; they are not runtime dependencies of the game.\n\n## Install Superpowers\n\nIn the Codex app, open Plugins and install Superpowers. In Codex CLI, use /plugins, search for Superpowers and select Install Plugin.\n\nIn Claude Code, use its official plugin marketplace:\n\n```text\n/plugin install superpowers@claude-plugins-official\n```\n\nIn Cursor Agent chat:\n\n```text\n/add-plugin superpowers\n```\n\nOther agents have their own installation routes. Use the [upstream Superpowers instructions](' + SKILL_SOURCES.superpowers + ').\n\n## Install PixiJS skills\n\nRun this in the checkout and follow the prompts for your coding agent and the full PixiJS collection:\n\n```sh\n' + PIXIJS_INSTALL + '\n```\n\nSee the [official PixiJS instructions](' + SKILL_SOURCES.pixijs + ').\n\n## Verify before coding\n\nAsk the agent to confirm installed and loaded skills, rather than inferring readiness from a website checkbox.\n\n```text\n' + SKILL_PREFLIGHT + '\n```\n\n[Use the interactive setup checklist](/start). Installation sources were checked on 15 October 2026; follow upstream instructions when a tool changes.' },
  { id: 'audience', slug: 'audience', title: 'Who Automata is for', category: 'Getting Started', description: 'Choose Automata based on your workflow and current requirements.', content: '# Who Automata is for\n\n## Who this is for\n\n' + AUDIENCE_FIT.map(item => '- ' + item).join('\n') + '\n\n## Who this is not for\n\n' + AUDIENCE_NOT_FIT.map(item => '- ' + item).join('\n') + '\n\n## Start from your background\n\n' + MIGRATION_GUIDES.map(guide => '- [From ' + guide.engine + '](/docs/' + guide.slug + ')').join('\n') + '\n\n[Current capabilities and licensing](/docs/capabilities).'},
  { id: 'faq', slug: 'faq', title: 'FAQ', category: 'Getting Started', description: 'Answers about agents, content, licensing, platforms, migration and community games.', content: '# FAQ\n\n' + FAQ_ITEMS.map(item => '## ' + item.question + '\n\n' + item.answer).join('\n\n') + '\n\n[Install agent skills](/docs/agent-setup), [make a first change](/start), or [visit the community showcase](/showcase).' },
)

export function syncDocs(outputDir = websiteDir, options: { frameworkDir?: string } = {}) {
  const docs: DocSection[] = []

  // The framework's guides (M8.6w) follow the hand-written docs; none exist until the framework writes `docs/guide`.
  const frameworkGuides = readGuides(options.frameworkDir ?? resolve(websiteDir, '../automata-framework'))
  for (const item of [...DEFAULT_DOCS, ...frameworkGuides]) {
    const content = item.content
    const toc = extractToc(content)
    docs.push({
      ...item,
      content,
      toc,
    })
  }

  // 1. Write src/data/docs.json
  const dataDir = join(outputDir, 'src/data')
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  writeFileSync(join(dataDir, 'docs.json'), JSON.stringify(docs, null, 2))

  // 2. Generate static/llms.txt
  const staticDir = join(outputDir, 'static')
  if (!existsSync(staticDir)) {
    mkdirSync(staticDir, { recursive: true })
  }

  const llmsIndex = `# Automata Framework

> Automata is a deterministic 2D game framework for the web. ${DISTRIBUTION_TARGETS}

## Documentation
${docs.map((d) => `- [${d.title}](/docs/${d.slug}): ${d.description}`).join('\n')}

## AI & Agent Skills
- [Automata AI Portal](/ai): Project context, architectural rules, and verification guidance.
- [Full documentation](/llms-full.txt): The framework's defined documentation corpus and its complete API reference for version ${apiIndex.version}, generated from the package declarations.
- [API reference](/llms-api.txt): Every export of the ${apiIndex.version} packages with its signature and doc comment, generated from the package declarations.
- [Site guides](/llms-guides.txt): The guides, task prompts and selected API examples on this site.

## API Reference
${CHEATSHEET_MODULES.map(module => `- [${module.title}](/cheatsheet#${module.id}): ${module.description}`).join('\n')}
`
  writeFileSync(join(staticDir, 'llms.txt'), llmsIndex.trim() + '\n')

  // 3. Generate static/llms-guides.txt (static/llms-full.txt and llms-api.txt are the framework's, from scripts/sync-api-index.ts)
  const llmsGuides = `# Automata Framework — Site Guides for Coding Agents

> Automata is a deterministic 2D game framework for the web. ${DISTRIBUTION_TARGETS}
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

---

# AI workflow
URL: /ai

## Project context
${AI_CONTEXT_FILES.map(file => `- ${file.path}: ${file.purpose}`).join('\n')}

## Architectural boundaries
${AI_RULES.map(rule => `### ${rule.title}\n\n${rule.detail}`).join('\n\n')}

## First task prompt
\`\`\`text
${AI_PROJECT_PROMPT}
\`\`\`

${AI_TASKS.map(task => `## ${task.title}\n\n${task.description}\nAPI: ${task.apiHref}\n\n\`\`\`text\n${task.prompt}\n\`\`\``).join('\n\n')}

## Review and verify
${AI_REVIEW_CHECKS.map(check => `- ${check}`).join('\n')}

\`\`\`sh
${AI_VERIFY_COMMANDS}
\`\`\`

---

# Selected API reference
URL: /cheatsheet
These examples and abbreviated contracts describe selected APIs, not every export.
The current checkout's instructions and TypeScript definitions take precedence.

${CHEATSHEET_MODULES.map(module => `## ${module.title}\nImport: ${module.name}\nURL: /cheatsheet#${module.id}\nSource: https://github.com/mcthaydt/automata-framework/blob/main/${module.sourcePath}\n\n${module.description}\n\n\`\`\`ts\n${module.example}\n\`\`\`\n\n${module.entries.map(entry => `### ${entry.name}\n\n${entry.description}\n${entry.receiver ? `Instance method on ${entry.receiver}.\n` : ''}\n\`\`\`ts\n${entry.signature}\n\`\`\`\nReturns: ${entry.returnType}\n${(entry.parameters ?? []).map(parameter => `- ${parameter.name} (${parameter.type}): ${parameter.desc}`).join('\n')}\n${(entry.notes ?? []).map(note => `- ${note}`).join('\n')}`).join('\n\n')}`).join('\n\n---\n\n')}
`
  writeFileSync(join(staticDir, 'llms-guides.txt'), llmsGuides.trim() + '\n')

  return docs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncDocs()
  console.log('Successfully synced docs to src/data/docs.json, static/llms.txt, and static/llms-guides.txt')
}
