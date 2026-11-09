// The prose of docs/stack.md. Edit this file, then run `pnpm docs:stack`; never edit the page.
// Versions and licenses are not written here: stack.ts reads them from docs/versions.md and the installed packages.
// Each card's claims cite where they come from (an ADR or a package in this repo), in plain words.

import type { StackSource } from './stack.ts'

export const STACK: StackSource = {
  intro: [
    'The libraries AF is built on, what each one does here and what AF adds on top.',
    '',
    "Versions are the exact pins in [versions.md](versions.md) (the vendored Ruken tarballs show their packed version). Licenses are read from each installed package's `package.json`. A library AF has chosen but not installed yet says so.",
  ].join('\n'),
  cards: [
    {
      library: 'PixiJS 8',
      tier: 'Core',
      packages: ['pixi.js'],
      does: 'Draws the game in 2D: WebGL2 by default, WebGPU opt-in per game (ADR 0002).',
      why: 'The games AF was proven in render with Pixi 8, in 2D and in 3D, so one renderer covers both. Not every host offers WebGPU, so the WebGL2 path is the one that must stay solid (ADR 0002).',
      adds: "`@automata/framework`'s renderer: the `/no-eval` entry every game imports first (no web target allows `eval`), renderer start-up with a WebGL2 default, a `RenderDelta` consumer that interpolates between sim ticks, the letterbox and canvas resolution, and GLSL + WGSL filter-program pairs.",
    },
    {
      library: 'Koota',
      tier: 'Core',
      packages: ['koota'],
      does: 'The entity-component store inside the deterministic sim (ADR 0001).',
      why: 'A spike found it deterministic across Node, Chromium, WebKit and Firefox, like Miniplex, and it adds relations with data, added/changed/removed tracking and struct-of-arrays storage at no determinism cost (ADR 0001).',
      adds: '`@automata/sim` keeps Koota behind a facade: its own monotonic `StableId` (Koota recycles IDs), StableId-ordered iteration, snapshot and restore, render deltas, seeded RNG, deterministic math and hashing, and `.replay` recording. Game code never imports Koota directly.',
    },
    {
      library: 'Zod',
      tier: 'Core',
      packages: ['zod'],
      does: 'Every schema: content files, sim command and event payloads, and saved settings.',
      why: "One schema language for content, commands and saves; Ruken's protocol and manifest use Zod too, so the Ruken target needs no second one (ADR 0003).",
      adds: 'Zod runs jitless under the `/no-eval` entry so it works under a CSP without `eval`; the content compiler turns Zod issues into `file:line:col` diagnostics.',
    },
    {
      library: 'Svelte 5',
      tier: 'Core',
      packages: ['svelte'],
      does: 'Menus, HUD and every screen outside the canvas, with rune stores for app state.',
      why: 'Small, fast screens with no virtual DOM, and the UI AF was proven with is Svelte; phones need real layouts, which its components give per screen size.',
      adds: "`@automata/framework`'s ui kit: mobile-first primitives (ScreenFrame, ActionBar, CornerControls, ScrollList, Dialog, LoaderOverlay, ErrorPanel), the single geometry owner (form factor, height tier, viewport tracking), focus navigation and browser hygiene, with layout-contract test helpers.",
    },
    {
      library: 'Paraglide',
      tier: 'Core',
      packages: ['@inlang/paraglide-js'],
      does: "Compiles the content compiler's locale keys into typed `t()` message functions.",
      why: 'Typed messages that tree-shake per language, already proven in a shipped game; hosts such as Ruken hand the game a locale to follow.',
      adds: "`@automata/framework`'s runtime: language negotiation (the player's saved choice, then the host's locale, the browser, the default) before the first screen, a typed `t()` over Paraglide's runtime, `Intl` formatting and `<html lang dir>`.",
    },
    {
      library: 'smol-toml',
      tier: 'Core',
      packages: ['smol-toml'],
      does: "Parses the TOML files under a game's `content/`.",
      why: 'A small, spec-complete TOML 1.0 parser with no dependencies, proven in a content compiler before AF.',
      adds: '`@automata/content` validates the parsed TOML with Zod, reports `file:line:col` diagnostics, writes canonical JSON with a content hash, generates TypeScript types, the locale keys and Ruken manifest fields, and runs as a Vite plugin with watch mode.',
    },
    {
      library: 'Ruken SDK',
      tier: 'Core',
      packages: ['@ruken/sdk', '@ruken/sdk-host', '@ruken/manifest', '@ruken/cli'],
      does: "The `ruken` target: the game side of Ruken's protocol, a fake host for tests, the manifest checks and CSP headers, and `ruken publish` (ADR 0006).",
      why: "Ruken is one of four peer targets. Only its adapter and its `ship` target import these, so AF uses Ruken's own contract instead of a copy of it (ADR 0006). They are vendored as tarballs until Ruken publishes them (`vendor/ruken/README.md`).",
      adds: "`@automata/framework`'s host contract, which AF owns: the `Hosting` service with typed errors and a fake host to test against; `@automata/tools` generates `ruken.toml`, checks it with `@ruken/manifest` and hands the build to `ruken publish`.",
    },
    {
      library: 'Vite, Vitest, Playwright',
      tier: 'Core',
      packages: ['vite', 'vitest', '@playwright/test'],
      does: 'Vite builds every game and example; Vitest runs unit tests and the cross-engine parity suites; Playwright drives browser journeys and the parity browsers.',
      why: "One toolchain from build to browser tests: Vitest reuses Vite's config, and Playwright runs the same journeys in Chromium, WebKit and Firefox.",
      adds: "`@automata/framework/testing`: sim and replay goldens that must match bit for bit in Node, Chromium, WebKit and Firefox, renderer-free screen fixtures and layout assertions (hit testing, target size, clipping); `automata-content`'s Vite plugin compiles content on build.",
    },
  ],
  notes: [],
}
