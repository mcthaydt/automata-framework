// The prose of docs/stack.md (PRODUCT spec §8). Edit this file, then run `pnpm docs:stack`; never edit the page.
// Versions and licenses are not written here: stack.ts reads them from docs/versions.md and the installed packages.
// Each card's claims cite where they come from (an ADR, a spec section, a package in this repo).

import type { StackSource } from './stack.ts'

export const STACK: StackSource = {
  intro: [
    'The libraries AF is built on, what each one does here and what AF adds on top. **Core** is the free foundation every game gets; **Plus** is the paid Automata Plus tier (PRODUCT spec §1, PD-1).',
    '',
    "Versions are the exact pins in [versions.md](versions.md) (the vendored Ruken tarballs show their packed version and RukenApp commit). Licenses are read from each installed package's `package.json`. A library AF has chosen but not installed yet says so and names the task that installs it.",
  ].join('\n'),
  cards: [
    {
      library: 'PixiJS 8',
      tier: 'Core',
      packages: ['pixi.js'],
      does: 'Draws the game in 2D: WebGL2 by default, WebGPU opt-in per game (ADR 0002).',
      why: "Both reference games render with Pixi 8: FloorFifty in 2D and The Last Light in 3D. Ruken's manifest declares `webgl2` and no WebGPU value, so the WebGL2 path is the one that must stay solid (ADR 0002).",
      adds: "`@mcthaydt/automata-render-pixi`: the `./no-eval` entry every game imports first (Ruken's CSP has no `eval`), renderer start-up with a WebGL2 default, a `RenderDelta` consumer that interpolates between sim ticks, the letterbox and canvas resolution, and GLSL + WGSL filter-program pairs.",
    },
    {
      library: 'Koota',
      tier: 'Core',
      packages: ['koota'],
      does: 'The entity-component store inside the deterministic sim (ADR 0001).',
      why: 'Spike S1 found it deterministic across Node, Chromium, WebKit and Firefox, like Miniplex, and it adds relations with data, added/changed/removed tracking and struct-of-arrays storage at no determinism cost (ADR 0001).',
      adds: '`@mcthaydt/automata-sim` keeps Koota behind a facade: its own monotonic `StableId` (Koota recycles IDs), StableId-ordered iteration, snapshot and restore, render deltas, seeded RNG, deterministic math and hashing, and `.replay` recording. Game code never imports Koota directly.',
    },
    {
      library: 'Effect',
      tier: 'Core',
      packages: ['effect'],
      does: 'Runs everything outside the sim: runtime services, the boot program, time, retries and resource disposal (ADR 0003).',
      why: 'The runtime needs ordered boot with failure states, retries and timeouts, disposal on screen exit and restart, an injectable clock and typed errors that each map to a UI state; FloorFifty and The Last Light do all of that by hand (ADR 0003).',
      adds: "Runtime managers are Effect services (`Context.Tag` + `Layer`), time comes from `Clock` and is tested with `TestClock`, and `Scope` replaces FloorFifty's `DisposeBag`. The sim never imports Effect (`check-boundaries` rejects it there) and the frame loop allocates no Effect per frame.",
    },
    {
      library: 'Zod',
      tier: 'Core',
      packages: ['zod'],
      does: 'Every schema: content files, sim command and event payloads, and saved settings.',
      why: "Ruken's protocol and manifest are written in Zod at the same version, so AF and Ruken share one schema language; Effect Schema is not adopted (ADR 0003).",
      adds: "Zod runs jitless under the `render-pixi/no-eval` entry so it works under Ruken's CSP; the content compiler turns Zod issues into `file:line:col` diagnostics.",
    },
    {
      library: 'Svelte 5',
      tier: 'Core',
      packages: ['svelte'],
      does: 'Menus, HUD and every screen outside the canvas, with rune stores for app state (master spec §3).',
      why: "FloorFifty's UI and Ruken's own `packages/ui` are Svelte, and Ruken requires a mobile layout under `display.metrics` on phones (master spec §4.1).",
      adds: '`@mcthaydt/automata-ui`: mobile-first primitives (ScreenFrame, ActionBar, CornerControls, ScrollList, Dialog, LoaderOverlay, ErrorPanel), the single geometry owner (form factor, height tier, viewport tracking), focus navigation and browser hygiene, with layout-contract test helpers.',
    },
    {
      library: 'Paraglide',
      tier: 'Core',
      packages: [],
      planned: { packages: ['@inlang/paraglide-js'], task: 'PRODUCT.L (core localization)' },
      does: "Compiles the content compiler's locale keys into typed `t()` message functions (PRODUCT spec §4).",
      why: 'FloorFifty already ships its localization on Paraglide, and Ruken asks every game to localize from `session.locale` (PRODUCT spec §4).',
      adds: "Planned in PRODUCT.L: language negotiation from Ruken's `session.locale`, `Intl` formatting, `<html lang dir>`, per-locale content, glyph coverage, the `xx-long` pseudo-locale in every layout contract and a language picker.",
    },
    {
      library: 'smol-toml',
      tier: 'Core',
      packages: ['smol-toml'],
      does: "Parses the TOML files under a game's `content/` (M1.3 content spec §8).",
      why: "FloorFifty's content compiler and Ruken both use it at this version.",
      adds: '`@mcthaydt/automata-content` validates the parsed TOML with Zod, reports `file:line:col` diagnostics, writes canonical JSON with a content hash, generates TypeScript types, the locale keys and Ruken manifest fields, and runs as a Vite plugin with watch mode.',
    },
    {
      library: 'Ruken SDK',
      tier: 'Core',
      packages: ['@ruken/sdk', '@ruken/sdk-host', '@ruken/manifest', '@ruken/cli'],
      does: "The host: the game side of Ruken's protocol, a fake host for tests, the manifest checks and CSP headers, and `ruken publish` (ADR 0004).",
      why: "Ruken is the reference host. FloorFifty already runs through these packages, so AF consumes them instead of re-deriving Ruken's contract (ADR 0004). They are vendored as tarballs until Ruken publishes them (`vendor/ruken/README.md`).",
      adds: '`@mcthaydt/automata-host`: the `Hosting` Effect service with typed errors and a test layer on the fake host; `@mcthaydt/automata-ship` generates `ruken.toml`, checks it with `@ruken/manifest` and hands the build to `ruken publish`.',
    },
    {
      library: 'Vite, Vitest, Playwright',
      tier: 'Core',
      packages: ['vite', 'vitest', '@playwright/test'],
      does: 'Vite builds every game and example; Vitest runs unit tests and the cross-engine parity suites; Playwright drives browser journeys and the parity browsers.',
      why: 'Ruken pins the same tools and versions, so a game and its host build and test the same way (versions.md).',
      adds: "`@mcthaydt/automata-testing`: sim and replay goldens that must match bit for bit in Node, Chromium, WebKit and Firefox, renderer-free screen fixtures and layout assertions (hit testing, target size, clipping); `automata-content`'s Vite plugin compiles content on build.",
    },
    {
      library: 'Rapier (deterministic-compat)',
      tier: 'Plus',
      packages: ['@dimforge/rapier2d-deterministic-compat', '@dimforge/rapier3d-deterministic-compat'],
      does: '2D and 3D physics inside the sim (M2.1).',
      why: 'The deterministic build gives bit-identical results in Node, Chromium, WebKit and Firefox, and `-compat` inlines the wasm, so there is no loader to set up (versions.md). The Last Light already uses Rapier 0.21.',
      adds: '`@mcthaydt/automata-physics`: a sim plugin that syncs bodies in, steps and syncs out each tick, adds its own snapshot section and raises collision events, with four-engine parity tests. It moves to `automata-plus` with PRODUCT.5.',
    },
    {
      library: 'Colyseus',
      tier: 'Plus',
      packages: [],
      planned: { packages: ['colyseus'], task: 'M7 (`net` and `server`)' },
      does: 'Rooms and transport for the `net` and `server` extensions (master spec §4).',
      why: "FloorFifty's multiplayer already runs on Colyseus: its network manager, room store and server rooms are the extraction source (extraction map).",
      adds: 'Planned in M7: a `NetworkPort` behind the client, a room-mirroring store, server rooms running the same sim, an input queue and tick scheduler, prediction and reconciliation.',
    },
  ],
  notes: [
    {
      title: "Why FloorFifty's Planck becomes Rapier",
      body: "FloorFifty simulates its races with Planck. AF uses Rapier instead: Rapier's deterministic build is already proven across Node, Chromium, WebKit and Firefox (M2.1), and one physics engine means one parity suite (PRODUCT spec §8, PD-2).",
    },
  ],
}
