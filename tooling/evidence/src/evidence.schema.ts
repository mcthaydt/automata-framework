// The evidence file (DX spec §3.10): what one af-linux parity run on `main` proved, for the website to render
// instead of hard-coded claims. Every value is read from a run or an artifact by cli.ts; nothing here is typed by
// hand. The website validates the file with this schema (cli.ts also writes it out as JSON Schema).
import { z } from 'zod'

/** The sim's state hash: XXH64, 16 hex digits (sim.hash()). */
const simHash = z.string().regex(/^[0-9a-f]{16}$/)

export const ENGINES = ['node', 'chromium', 'firefox', 'webkit'] as const
export const EngineSchema = z.enum(ENGINES)
export type Engine = z.infer<typeof EngineSchema>

/**
 * One engine's run of one golden, as the golden test records it in its Vitest task meta (`goldenEvidence`).
 * The runtime is what the engine says about itself: Node's `process.version`, or the browser's user agent.
 */
export const GoldenEvidenceSchema = z.object({
  /** A stable name for the scenario, `<package>/<run>`. */
  scenario: z.string().min(1),
  seed: z.number().int(),
  /** Ticks stepped in the run (the sim's tick at the end minus its tick at the start). */
  ticks: z.number().int().min(1),
  hash: simHash,
  runtime: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('node'), version: z.string().min(1) }),
    z.object({ kind: z.literal('browser'), userAgent: z.string().min(1) }),
  ]),
})
export type GoldenEvidence = z.infer<typeof GoldenEvidenceSchema>

const EngineHashSchema = z.object({
  engine: EngineSchema,
  /** Node's version, or the browser version from its user agent (WebKit reports its Safari version). */
  version: z.string().min(1),
  hash: simHash,
})

export const GoldenSchema = z.object({
  scenario: z.string().min(1),
  seed: z.number().int(),
  ticks: z.number().int().min(1),
  /** True when every engine's hash is the same, which is what the parity suites assert. */
  enginesAgree: z.boolean(),
  /** The test files that ran it, relative to the repository root. */
  sources: z.array(z.string().min(1)).min(1),
  /** One hash per engine, in ENGINES order. */
  hashes: z.array(EngineHashSchema).length(ENGINES.length),
})
export type Golden = z.infer<typeof GoldenSchema>

/** Where the file was made: a GitHub Actions run (with its URL), or a developer's machine. */
export const RunSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('ci'),
    url: z.url(),
    id: z.string().min(1),
    attempt: z.number().int().min(1),
    workflow: z.string().min(1),
    job: z.string().min(1),
    event: z.string().min(1),
    ref: z.string().min(1),
  }),
  z.object({ kind: z.literal('local') }),
])
export type Run = z.infer<typeof RunSchema>

export const PackageSchema = z.object({
  name: z.string().min(1),
  /** The version in the package's manifest at this revision. */
  version: z.string().min(1),
  /** True when Changesets' release tag `<name>@<version>` exists, i.e. this version was published. */
  released: z.boolean(),
})

/**
 * The `automata check` results for the `create-game` output. Neither exists yet: `create-game` is DX.5 and
 * `automata check` is DX.6. Until they land the file says so, and a "checked" shape is added with them (02,
 * follow-up DX.9a); nothing else is accepted, so a file cannot claim results that were never produced.
 */
export const AutomataCheckSchema = z.object({
  status: z.literal('pending'),
  waitingOn: z.array(z.string().min(1)).min(1),
  note: z.string().min(1),
})

export const EvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  revision: z.object({
    sha: z.string().regex(/^[0-9a-f]{40}$/),
    /** True when the working tree had uncommitted changes (a local run only; CI checks out a clean tree). */
    dirty: z.boolean(),
  }),
  run: RunSchema,
  /** The Playwright version that drove Chromium, Firefox and WebKit. */
  playwright: z.string().min(1),
  goldens: z.array(GoldenSchema).min(1),
  packages: z.array(PackageSchema).min(1),
  automataCheck: AutomataCheckSchema,
})
export type Evidence = z.infer<typeof EvidenceSchema>
