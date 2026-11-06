# Automata site redesign

Owner approved the audit fixes and Design Taste direction on 14 October 2026. The original dark/card brief is superseded. Work stays in the website; framework code and existing demo bundles are inputs.

## Subject and argument

Inventory: Emberwick's hooded lantern-bearer; one playable mossy room; Endesga 64 pixel art; stable entity IDs; seeded random streams; simulation-owned gameplay; fixed ticks; separate render deltas; Effect-scoped runtime; Ruken-first hosting; runnable source beside demos.

On this page, Emberwick's simulation and presentation become distinct colour chapters: the words describe the contract, then the actual game demonstrates it. The live thing is the existing playable starter, with a pause/unload control and a standalone link.

The argument: write game rules in TypeScript (verified small sim example); see the result (existing Emberwick bundle); inspect the pieces (four actual example interfaces); follow ownership boundaries (simulation, presentation, runtime); read the setup guide (private-package prerequisites rather than an unverified public install).

## Direction and copy deck

Design Taste: Type and nothing else, seed 2089695647, Chivo, Candy chapters. Chosen over a tile board and narrow quiet column because words can express the state-ownership contract at scale, with the product itself appearing afterward. No palette redraws. The showcase blueprint was changed from an editable headline to “Live demo with controls”: Automata produces playable games, not editable headlines. Product interfaces replace stock imagery. No invented customers, numbers, screenshots or certification claims.

Hero: Games, in your hands.
Support: A TypeScript game framework for deterministic simulation and PixiJS presentation, built for the web and Ruken.
Action: Play the starter.
Intro: Rules become a room. Run and jump through Emberwick, the framework's playable 2D starter.
Showcase: Open the machinery. Inspect rendering, physics, responsive UI, and runtime flow in standalone examples.
How it works: One state. Many views. Simulation owns gameplay; presentation reads render deltas; Effect manages resources outside the sim.
Close: Make the next move. Read the setup guide, then explore the source.

## Implementation and proof

- Shared flat-colour tokens, five type steps, visible focus, mobile navigation, main landmark, skip link, managed metadata and social image.
- Native dialog search over pages, docs, API and demos, with real arrow navigation, focus restoration and editable-safe shortcuts.
- One clipboard component for truthful success/failure feedback, lazy syntax highlighting, corrected generated docs and curated real API entries.
- URL-owned examples and canonical docs navigation, verified boot markers with bounded loading, retry and pause/unload.
- Reclassify reference projects honestly and remove unverifiable external commands/community links.
- Focused regression tests, Svelte check, full website unit suite, static build, source style lint; browser inspector and screenshot critique if the environment allows it. Report blocked gates separately.
