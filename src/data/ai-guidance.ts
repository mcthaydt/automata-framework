import { SKILL_PREFLIGHT } from './agent-setup'

export const AI_CONTEXT_FILES = [
  { path: 'AGENTS.md', purpose: 'Project rules, architecture, and required checks. Read applicable instructions in the directories you will edit.' },
  { path: 'package.json', purpose: 'Available scripts, tool versions, dependencies, and package exports. Read both the workspace and target package manifests.' },
  { path: 'examples/base-2d/src/base-sim.ts', purpose: 'Simulation creation, room content, command envelopes, and starting entities.' },
  { path: 'examples/base-2d/src/sim/', purpose: 'Working component, command, event, resource, system, and plugin definitions.' },
  { path: 'The closest focused example', purpose: 'Use runtime/boot-and-flow, render-pixi/renderer-2d, host/lifecycle-and-saves, content/hot-reload, or ui/primitives for the integration being changed.' },
  { path: 'The nearest tests and public types', purpose: 'Actual accepted inputs, failure behavior, cleanup requirements, and exported names. Prefer these over a guessed API.' },
]

export const AI_RULES = [
  { title: 'Simulation owns gameplay state', detail: 'Send commands from input and UI. Systems apply gameplay changes during fixed ticks. Initial scene setup may spawn entities before stepping; presentation observes the results.' },
  { title: 'Keep ticks repeatable', detail: 'No I/O, wall clocks, Math.random, DOM, or Effect in simulation systems. Use ctx.rng, deterministic math, stable traversal, and the same code, content, seed, and command stream when comparing runs.' },
  { title: 'Effect owns work outside the sim', detail: 'Use Effect for loading, hosting, saves, timers, and resource lifetimes. Keep simulation steps synchronous and close scopes, simulations, subscriptions, and render resources with their owner.' },
  { title: 'Use the renderer boundary', detail: 'Import the renderer no-eval entry before initializing PixiJS. Draw from render deltas, interpolate previous and current values, and handle a full resync after restore. Test the actual host content security policy.' },
  { title: 'Honor host capabilities', detail: 'Use Hosting and the Ruken SDK. Wait for readiness, check granted capabilities, validate saved data, and report save failures. A denied hosted capability must not silently fall back to device storage.' },
  { title: 'Keep shared contracts canonical', detail: 'Extend the component, schema, service, or package that owns a behavior. Keep content, snapshot, replay, and host contracts in their existing owners. Check the exact package entry point before using an export.' },
]

export const AI_PROJECT_PROMPT = SKILL_PREFLIGHT + `

Task: add a double jump to the existing Emberwick game.
Read AGENTS.md, the workspace and base-2d package manifests, and the current
setup, input, movement, plugin, and test files before editing.

Acceptance criteria:
- A fresh jump press in the air gives the player one extra jump.
- Holding jump does not repeat it, and a third jump is refused until landing.
- Landing restores the extra jump. Keyboard and touch use the same command.
- Snapshots preserve jump availability and replayed inputs produce the same state.
- The original mode still behaves as before, so I can play both versions.

Add the behavior through a small plugin using the starter's existing definitions.
Do not change player-move.system.ts or the renderer. Keep jump availability
in simulation state and reuse the existing jump event for visual feedback.

Make the smallest coherent change in the responsible layer. Keep input as commands,
gameplay updates in systems, and I/O and Effect outside the simulation.
Verify exported names against the current TypeScript definitions.
Run focused tests, then the example's check and build scripts from the workspace root.
Report changed files, the exact checks and outcomes, how to play the result,
and anything that still needs browser, host, or device verification.`

export const AI_TASKS = [
  {
    id: 'game-rule', title: 'Add a collectible',
    description: 'Add a collectible without letting its sprite become the source of truth.',
    apiHref: '/cheatsheet#defineSystem', apiLabel: 'Simulation systems',
    prompt: `Add a collectible to Emberwick that can be collected once when the player overlaps it.
Read the room, player components, goal system, plugin, and movement tests first.
Keep collectible state and collection rules in the sim. Emit a registered event
for presentation to consume; a sprite callback must not award the collectible.
Test overlap, non-overlap, and repeated ticks at the same location.
Use a fixed room and seed. Verify that only one collection event is emitted.
Register all new definitions, run the focused tests and example checks,
and explain how to play and inspect the result.`,
  },
  {
    id: 'input', title: 'Add a dash',
    description: 'Carry a new action from keyboard and touch through a validated command.',
    apiHref: '/cheatsheet#defineCommand', apiLabel: 'Command definitions',
    prompt: `Add a dash action to the existing movement flow, with keyboard and touch input.
Read the input adapters, command schema, player-input system, movement system,
and plugin first. Reuse the current command envelope and sequence convention.
Input requests the action; the sim owns dash availability, duration, and movement.
Test accepted and invalid payloads, press versus hold, release or cancellation,
and attempts to dash while unavailable. Inspect StepResult.rejected for failures.
Keep keyboard and touch behavior equivalent and preserve existing movement tests.
Run focused tests and the example checks; list the controls for manual testing.`,
  },
  {
    id: 'presentation', title: 'Make jumps feel good',
    description: 'Make an event visible without changing the simulation from the renderer.',
    apiHref: '/cheatsheet#createPixiRenderer', apiLabel: 'Renderer factory',
    prompt: `Add a short visual response when the player's existing jump event is emitted.
Read the event, renderer wiring, and nearest presentation tests before editing.
Keep the effect outside the sim and preserve the gameplay command stream and state.
Use the current PixiJS v8 APIs and the no-eval entry. Handle the first frame,
entity removal, restore resync, restart, and disposal without leaking views.
Respect reduced motion where the effect introduces nonessential movement.
Run relevant checks, compare simulation hashes for the same inputs,
and report which renderer and device behavior was actually inspected.`,
  },
  {
    id: 'content', title: 'Author a room',
    description: 'Validate authored data and keep generated outputs reproducible.',
    apiHref: '/cheatsheet#defineContentSchema', apiLabel: 'Content schemas',
    prompt: `Add a validated content field for a game rule using the closest content example.
Read the current schema, TOML, compiler configuration, and consuming system first.
Define the field once in its owning Zod schema and validate the allowed range.
Keep gameplay data in the simulation content partition. Update the consumer
without hardcoding a second copy or hand-editing generated content or hashes.
Test a valid value, an invalid value, and the diagnostic location.
Rebuild generated outputs and verify them. If live editing is used, check that
an invalid save preserves the last good playable content. Report the checks.`,
  },
  {
    id: 'saves', title: 'Save progress',
    description: 'Persist progress through the host and explain failure states to the player.',
    apiHref: '/cheatsheet#Hosting', apiLabel: 'Hosting and saves',
    prompt: `Add a versioned progress save through the existing Hosting service.
Read host/lifecycle-and-saves, the runtime settings or save boundary, and tests.
Reuse the live session, wait for readiness, and check the saves capability.
Validate decoded payloads with Zod before applying any gameplay state.
Test missing, valid, malformed, incompatible, denied, and failed save/load cases.
Preserve stored data when loading fails. Keep I/O outside simulation systems.
Do not silently switch a denied hosted save to localStorage or device storage.
Distinguish a local update from remote persistence; inspect save status or flush.
Run relevant tests and report which hosted or standalone paths were verified.`,
  },
  {
    id: 'release', title: 'Prepare a release',
    description: 'Check and package the artifact before choosing a publishing destination.',
    apiHref: '/cheatsheet#defineShipConfig', apiLabel: 'Shipping configuration',
    prompt: `Prepare the current game for release using its existing scripts and ship.config.ts.
Read package.json, the ship configuration, and the nearest release checks.
Verify that package version, game ID, runtime capabilities, and asset paths agree.
Run the relevant tests, type checks, build, and prepare-ruken script.
Inspect the prepared artifact and generated ruken.toml. Test the built game
under its intended base path and content security policy where available.
Check asset provenance and required notices. Keep credentials outside the bundle.
Report artifact location, commands and results, and remaining browser/device/host
checks. Identify any required publishing destination and environment separately;
a local prepare is not a completed deployment.`,
  },
]

export const AI_REVIEW_CHECKS = [
  'Play the acceptance case yourself. Check the changed behavior and a nearby action that should still work.',
  'Review the diff: gameplay state has one owner, exports exist at the imported entry point, and generated data comes from its source.',
  'Read test assertions, including invalid input, failure, restart, and cleanup paths relevant to the change.',
  'Ask for the exact commands and results. Separate focused unit checks, a production build, browser behavior, host integration, and physical-device checks.',
  'For deterministic changes, compare the same seed, content, initial state, and commands. Investigate the first divergence before changing a golden hash.',
  'For mobile UI, check keyboard and touch, rotation, compact height, focus, and actions above the on-screen keyboard.',
]

export const AI_VERIFY_COMMANDS = `# From the framework workspace root, for the Emberwick starter:
pnpm --filter @af-examples/base-2d check
pnpm --filter @af-examples/base-2d build
pnpm --filter @af-examples/base-2d prepare-ruken`
