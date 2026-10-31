// Three docs written from the framework's own records, not from memory: the service model (ADR 0003), saves and their
// migrations (M5 spec §4.2, §5, §6; `packages/runtime/src/save/save.schema.ts`) and Automata Plus (docs/00 business
// model, 2026-10-30). Ritmo gaps 6 and 7 and M10.4's Plus docs section. `tests/deep-docs.test.ts` pins what each says to its source.

export interface DeepDoc {
  id: string
  slug: string
  title: string
  category: string
  description: string
  content: string
}

export const SERVICE_MODEL_DOC: DeepDoc = {
  id: 'service-model',
  slug: 'service-model',
  title: 'Services and failure',
  category: 'Core',
  description: 'What the simulation owns, what the runtime owns, and what is not undone when something fails.',
  content: `# Services and failure

## Two sides

The simulation owns gameplay state and nothing else. It is plain synchronous TypeScript with no I/O, no clock and no \`Math.random\`, and it never imports Effect. Everything around it, the host adapter, boot, screens, saves, audio, input and the frame loop, is the runtime, and the runtime is built from Effect services.

## Services are explicit dependencies

A runtime manager is an Effect service: a \`Context.Tag\` and a \`Layer\`. A manager that needs the clock asks for Effect's \`Clock\` instead of reading \`Date\`, so a test replaces it with \`TestClock\`. A manager that holds something open (a listener, a timer, an audio node) registers its release with a \`Scope\`, and leaving a screen or restarting the game closes the scope. Game code meets Effect only where it registers an extension or a custom service; systems, components and commands stay Effect-free.

## What failure does

A failure in the runtime is a typed value, not a thrown string. Boot reports a closed union of failures and each one maps to a screen state; [Boot errors](/docs/boot-errors) lists them. Retries and timeouts are part of the program that owns them (the handshake, loading stalls, the exit grace), not a global handler.

## What is not rolled back

A failed runtime step does not rewrite the simulation. The sim has already advanced by whole ticks, and a tick either completes or is not run. A write the host refused is not retried against another store: when the hosted save capability is denied or missing, the game reports that and does not fall back to device storage. A defect in game code after boot is not a typed failure, and this page is not a claim that every failure is caught.

## Where this is decided

[ADR 0003, Effect for everything outside the sim](https://github.com/mcthaydt/automata-framework/blob/main/docs/adr/0003-effect-outside-the-sim.md) records the decision and what it rules out. Zod stays the one schema language on both sides.
`,
}

export const SAVES_DOC: DeepDoc = {
  id: 'saves',
  slug: 'saves',
  title: 'Saves and migrations',
  category: 'Core',
  description: 'How a save is versioned, migrated step by step, and kept when this build cannot read it.',
  content: `# Saves and migrations

## What a save is

A game describes its save with \`SaveDef\`: a key prefix, the \`version\` of the data (an integer from 1), a Zod \`schema\`, an \`empty\` value for a new slot, and \`migrations\`. It may name a number of slots and an autosave policy. The data is stored through the host as a self-describing record that carries its version, the content hash it was written with and the time.

## Migrations run one step at a time

\`migrations[n]\` turns version \`n\` data into version \`n + 1\` data. A save written at version 1 and opened by a version 3 build runs step 1, then step 2, and then the schema parses the result. Write each step as a pure function of the record it receives.

## When a save cannot be used

- **A step is missing, a step throws, or the parse fails:** the slot is \`unreadable\`. It is shown as damaged and kept exactly as it is; autosave never touches it, and it is overwritten only if the player chooses to.
- **The save is from a newer build:** the slot is read-only in this build. No write, autosave or migration changes its bytes, so opening an older build does not erase newer progress.
- **A field this build does not know:** it rides through, so a write by an older build of the same version keeps it.

## Settings are different on purpose

Settings are versioned and migrated too, but losing a preference is acceptable and losing progress is not, so settings do not use the save rules above.

## Where the host stores it

Saves go through the host's save capability. If the host denies it, the game says so. It does not write to the device instead.

The rules are in the M5 spec (§4.2, §5 and §6) and the types are in \`SaveDef\`, in the runtime package's API reference.
`,
}

export const PLUS_DOC: DeepDoc = {
  id: 'plus',
  slug: 'plus',
  title: 'Automata Plus',
  category: 'Plus',
  description: 'The optional extensions and kits that live outside the core framework.',
  content: `# Automata Plus

## What it is

Core is what every game needs: the simulation, the runtime, the Pixi renderer, the interface primitives, the host contract and the content compiler. Plus is everything optional, kept in a repository and registry of its own so that no extension edits a core file and core never imports an extension.

## Cost

Plus is free. The framework's business model changed on 2026-10-30: core and every extension are free, and the only paid product is the editor suite as iOS and Android apps. The editors stay free on the web and desktop.

## How a game uses it

An extension registers itself with \`defineExtension\`. A kit is source a game copies in with \`automata add\`, then owns and edits. Extensions that touch the simulation do so through the simulation's public entries, so a game that does not install them is unchanged.

## What is available today

Plus is not yet open to install from. This section lists each extension here, with its install command, when it is published.
`,
}
