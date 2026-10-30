# Ritmo comparison and ideas worth stealing

> Written 2026-10-25. Sources: the [Ritmo repo](https://github.com/typeonce-dev/ritmo) README and the [Ritmo site](https://ritmo.typeonce.dev/), both read through a page summarizer, not the code. Our side comes from `AGENTS.md` and the `automata_website` checkout. Nothing here is verified against Ritmo's source; check a claim in the code before building on it.

Ritmo (`@typeonce/ritmo`, MIT) is an agent-first, type-safe ECS runtime for TypeScript. It is a runtime only: the developer brings the loop and renderer. Optional packages cover math, browser input, renderer-agnostic render sync, a PixiJS adapter, rollback/lockstep netcode, devtools and an oxlint plugin.

## Ideas worth stealing

These are candidates, not decisions. Each needs a spec in its owning milestone before any implementation (AGENTS.md: a roadmap does not authorize implementation).

| #   | Idea                                  | Ritmo's version                                                                                                                        | Likely owner                | Open question                                                                                                 |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 1   | Typed system access                   | Each system declares its queries and resources and its `run` receives only that access; the compiler rejects writes to read-only data. | Sim package                 | Can this be layered over Koota without a second query abstraction?                                            |
| 2   | Rollback of a failing system          | A system returns an error `Result`; the tick stops and that system's writes roll back.                                                 | Sim package                 | The sim has no I/O and cannot throw across ticks today; check how this meets replay and cross-engine goldens. |
| 3   | Headless "why did this change" report | A Node session runs frames, checks invariants and names the system and tick that changed a value.                                      | Devtools / testing          | Could reuse replay checkpoints; must not slow `step`.                                                         |
| 4   | Deterministic-sim lint as a package   | `@typeonce/oxlint-plugin-ritmo` is installable by game authors.                                                                        | Tooling (`pnpm boundaries`) | `boundaries` is internal to `packages/sim` today; can game authors run it on their own sim code?              |

Also noted, lower priority: compile-time errors that name the fix; required components checked at spawn; services as explicit dependencies of a system (a missing one fails to compile); spawn-ordered query results.

## Packages and engine, side by side

|                         | Ritmo                                                 | AF                                                                                           |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Scope                   | ECS runtime; bring your own loop and renderer         | Sim, content compiler, rendering (2D and 3D), responsive UI, hosting, publishing, editors    |
| Sim and effects         | Plain TypeScript, `Result` values, no Effect          | Koota sim with no I/O; Effect for everything outside it                                      |
| Determinism             | Seeded RNG, deterministic trig, spawn-ordered queries | Bit-identical goldens in Node, Chromium, WebKit and Firefox; a mismatch is never rebaselined |
| Rendering               | Generic entity-to-node sync plus a Pixi adapter       | PixiJS for 2D and 3D, WebGL2 default, WebGPU opt-in, parity rule                             |
| Netcode                 | Rollback and lockstep packages exist                  | Planned (M7)                                                                                 |
| Host and publishing     | None                                                  | Ruken reference host, itch.io target, publish pipeline                                       |
| Provenance              | Four showcase games                                   | Extracted from FloorFifty, The Last Light and Ruken with recorded source commits             |
| Compile-time guarantees | Core pitch                                            | Lint-style gates (`boundaries`, `style`, `knip`) and tests                                   |

## Website pairing

|                   | Ritmo site                                                                         | `automata_website`                                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Audience          | Developers who want fewer logic bugs                                               | People with a game idea who work with a coding agent; developers coming from Unity, Godot, Unreal, GameMaker or web        |
| Hero              | "The type-safe ECS runtime for TypeScript"                                         | "Make a game. Make it yours." with a playable Emberwick                                                                    |
| Proof shown       | TypeScript compiler output and code samples; an interactive two-player "Town" demo | Playable starter, a double-jump worked change with recorded proof, a source explorer, lighthouse and axe checks            |
| Agent story       | A "Use it with an agent" docs page, `SETUP.md`, a skill, `llms.txt`                | `/ai` portal, `llms.txt`, `llms-full.txt`, an agent-setup page, task prompts                                               |
| Onboarding        | Start with one system                                                              | Make your first change; migration guides from other engines                                                                |
| Install path      | npm link in the footer                                                             | None yet: the packages are unpublished and the install claims were cut (see the website's `docs/2026-10-14-cut-claims.md`) |
| Claims discipline | Not assessed                                                                       | A ledger of cut claims with restoration gates                                                                              |
| Brand             | A brand page                                                                       | Not assessed                                                                                                               |

What the site comparison suggests:

- **They show the guarantee, we describe it.** Their page leads with the compiler rejecting a bad system. Our determinism and boundary claims are narrowed (rightly) and mostly prose. A short, real example of a rejected change, once ideas 1 or 4 exist, would be stronger than copy.
- **We are ahead on first-run experience.** Playing the starter and making a tested first change is a sharper path than their code-first landing. Keep it.
- **We cannot match their install link until DX.11.** Their footer links npm and ours cannot until the public publish lands.
- **Their agent page is a single link.** Ours is broader, but the cut-claims ledger says several agent integrations (skills install, plugin marketplace) are unverified; fix that before comparing agent stories.

## Next step

If the Owner wants any of ideas 1 to 4, each goes to the milestone that owns it as a request, with a spike on Koota feasibility first for 1 and 2. Reading Ritmo's source (system access types, rollback, netcode) is the cheapest way to turn the open questions above into facts.
