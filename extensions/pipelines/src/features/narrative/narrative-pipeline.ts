// The `narrative` pipeline: a scene folder's `narrative.pipe.toml` names the game's scene module,
// which exports `narrative`, a `NarrativeToolsScene` (its puzzle and lines, canon and locale text, deck, beats, help and
// the sim to play routes in). `run` writes the lint and coverage reports, the screenplay, the puzzle-help doc and the
// audit; `check` fails on a lint error (a conversation with a dead end fails), a required beat a route misses, a
// hint after its risk, broken puzzle help, and a screenplay or help doc that is stale or edited by hand. Free: no stage
// is paid. The scene module and the tools load when a stage runs (as `puzzle` and `systems`).
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Finding, NarrativeToolsScene } from '@automata/narrative/tools'
import { canonicalJson } from '@automata/sim'
import { hex64, utf8, xxhash64 } from '@automata/sim/hash'
import { Effect } from 'effect'
import { z } from 'zod'
import { Files } from '../../shared/node/files.ts'
import {
  type CheckResult,
  definePipeline,
  type PipelineDef,
  type StageContext,
  StageFailed,
} from '../../shared/pipeline.ts'
import { type NarrativeAudit, type NarrativeFinding, renderAudit } from './narrative-audit.ts'

export interface NarrativePipeSpec {
  /** The scene module, relative to the scene folder and inside it. */
  readonly scene: string
  /** The files the narrative is made from (lines, locale, dialogue, deck, beats, help), inside the folder: the stage cache's inputs and the docs' stamp. */
  readonly sources?: readonly string[] | undefined
  /** The act the screenplay is titled for (default: the scene's id). */
  readonly act?: string | undefined
}
export const narrativePipeSpec: z.ZodType<NarrativePipeSpec> = z.strictObject({
  scene: z.string().min(1),
  sources: z.array(z.string().min(1)).optional(),
  act: z.string().min(1).optional(),
})

const LINT = 'reports/narrative-lint.json'
const COVERAGE = 'reports/narrative-coverage.json'
const HELP_REPORT = 'reports/narrative-help.json'
const AUDIT_JSON = 'reports/narrative-audit.json'
const AUDIT_MD = 'narrative-audit.md'
const SCREENPLAY = 'screenplay.md'
const HELP_DOC = 'help.md'
const COMMAND = 'automata pipe narrative screenplay'
type Ctx = StageContext<NarrativePipeSpec>

const failing = (stage: string) => (cause: unknown) => new StageFailed({ stage, reason: String(cause) })
const tools = (stage: string) =>
  Effect.tryPromise({ try: () => import('@automata/narrative/tools'), catch: failing(stage) })

/** The scene module, and the stamp of its sources as they are now (the docs' stamp). */
const loadScene = (ctx: Ctx, stage: string) =>
  Effect.gen(function* () {
    const loaded = yield* Effect.tryPromise({
      try: async () =>
        (await import(pathToFileURL(join(ctx.dir, ctx.spec.scene)).href)) as {
          narrative?: NarrativeToolsScene
        },
      catch: (cause) => new StageFailed({ stage, reason: `the scene module: ${String(cause)}` }),
    })
    if (loaded.narrative === undefined)
      return yield* new StageFailed({ stage, reason: `${ctx.spec.scene} exports no narrative` })
    const files = yield* Files
    const sources: { path: string; hash: string }[] = []
    for (const path of ctx.spec.sources ?? [])
      sources.push({ path, hash: hex64(xxhash64(utf8(yield* files.readText(join(ctx.dir, path))))) })
    const stamp = `sources: ${sources.map((s) => `${s.path} xxh64 ${s.hash}`).join('; ') || 'none'}`
    return { narrative: loaded.narrative, sources, stamp }
  })
const write = (ctx: Ctx, file: string, text: string) =>
  Effect.flatMap(Files, (files) => files.writeText(join(ctx.dir, file), text))
const json = (value: unknown): string => `${canonicalJson(JSON.parse(JSON.stringify(value)))}\n`
const inputs = (ctx: Ctx) => ['narrative.pipe.toml', ctx.spec.scene, ...(ctx.spec.sources ?? [])]
const params = (ctx: Ctx) => ({ act: ctx.spec.act ?? null })
const errors = (found: readonly Finding[]) => found.filter((f) => f.level === 'error')
const detailOf = (found: readonly Finding[], fallback: string): string =>
  errors(found)
    .map((f) => `${f.rule} ${f.id}: ${f.detail}`)
    .join('; ') || fallback

/** Everything the stages and `check` compute from the scene, once. */
const analyse = (ctx: Ctx, stage: string) =>
  Effect.gen(function* () {
    const t = yield* tools(stage)
    const loaded = yield* loadScene(ctx, stage)
    const lint = t.lintScene(loaded.narrative)
    const coverage = yield* Effect.tryPromise({
      try: () => t.coverageOf(loaded.narrative),
      catch: failing(stage),
    })
    const help = t.helpFindings(loaded.narrative)
    const act = ctx.spec.act ?? loaded.narrative.game.scene
    return {
      ...loaded,
      lint,
      coverage,
      help,
      screenplay: t.screenplayOf(loaded.narrative, coverage, { act, stamp: loaded.stamp, command: COMMAND }),
      helpDoc: t.helpDoc(loaded.narrative, loaded.stamp),
    }
  })

/** A generated file against what its stage makes now: current, or stale (its sources moved) or edited by hand. */
const docStatus = (ctx: Ctx, path: string, fresh: string) =>
  Effect.gen(function* () {
    const files = yield* Files
    if (!(yield* files.exists(join(ctx.dir, path)))) return { path, ok: false, detail: 'is missing' }
    const text = yield* files.readText(join(ctx.dir, path))
    if (text === fresh) return { path, ok: true, detail: 'current' }
    return {
      path,
      ok: false,
      detail:
        text.split('\n')[1] === fresh.split('\n')[1]
          ? 'differs from what the pipeline writes (edited by hand?)'
          : 'is stale: its sources changed',
    }
  })

export const narrativePipeline: PipelineDef<NarrativePipeSpec> = definePipeline<NarrativePipeSpec>({
  name: 'narrative',
  spec: narrativePipeSpec,
  specFile: 'narrative.pipe.toml',
  stages: [
    {
      id: 'lint',
      inputs,
      outputs: () => [LINT],
      run: (ctx) =>
        Effect.gen(function* () {
          const t = yield* tools('lint')
          const { narrative } = yield* loadScene(ctx, 'lint')
          const lint = t.lintScene(narrative)
          yield* write(ctx, LINT, json(lint))
          const n = lint.narrative.length + lint.dialogue.length + lint.deck.length
          return { notes: `${n} findings` }
        }),
    },
    {
      id: 'coverage',
      inputs,
      outputs: () => [COVERAGE],
      run: (ctx) =>
        Effect.gen(function* () {
          const t = yield* tools('coverage')
          const { narrative } = yield* loadScene(ctx, 'coverage')
          const c = yield* Effect.tryPromise({
            try: () => t.coverageOf(narrative),
            catch: failing('coverage'),
          })
          yield* write(
            ctx,
            COVERAGE,
            json({ routes: c.routes, beats: c.beats, findings: c.findings, hints: c.hints }),
          )
          return { notes: `${c.routes.length} routes` }
        }),
    },
    {
      id: 'screenplay',
      inputs,
      params,
      outputs: () => [SCREENPLAY],
      run: (ctx) =>
        Effect.gen(function* () {
          const t = yield* tools('screenplay')
          const { narrative, stamp } = yield* loadScene(ctx, 'screenplay')
          const played = yield* Effect.tryPromise({
            try: () => t.coverageOf(narrative),
            catch: failing('screenplay'),
          })
          const act = ctx.spec.act ?? narrative.game.scene
          yield* write(ctx, SCREENPLAY, t.screenplayOf(narrative, played, { act, stamp, command: COMMAND }))
          return { notes: SCREENPLAY }
        }),
    },
    {
      id: 'help',
      inputs,
      outputs: () => [HELP_DOC, HELP_REPORT],
      run: (ctx) =>
        Effect.gen(function* () {
          const t = yield* tools('help')
          const { narrative, stamp } = yield* loadScene(ctx, 'help')
          yield* write(ctx, HELP_DOC, t.helpDoc(narrative, stamp))
          const found = t.helpFindings(narrative)
          yield* write(ctx, HELP_REPORT, json(found))
          return { notes: `${found.length} findings` }
        }),
    },
    {
      id: 'audit',
      inputs,
      params,
      outputs: () => [AUDIT_JSON, AUDIT_MD],
      run: (ctx) =>
        Effect.gen(function* () {
          const x = yield* analyse(ctx, 'audit')
          const tag = (stage: string, found: readonly Finding[]): NarrativeFinding[] =>
            found.map((f) => ({ stage, ...f }))
          const findings = [
            ...tag('lint', x.lint.narrative),
            ...tag('dialogue', x.lint.dialogue),
            ...tag('deck', x.lint.deck),
            ...tag('beats', x.coverage.findings),
            ...tag('hints', x.coverage.hints.findings),
            ...tag('help', x.help),
          ].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
          const audit: NarrativeAudit = {
            scene: x.narrative.game.scene,
            sources: x.sources,
            routes: x.coverage.routes.map((r) => ({ name: r.name, steps: r.steps.length })),
            beats: x.coverage.beats.map((b) => ({ id: b.id, required: b.required, reach: b.reach })),
            findings,
            files: [
              yield* docStatus(ctx, SCREENPLAY, x.screenplay),
              yield* docStatus(ctx, HELP_DOC, x.helpDoc),
            ],
          }
          yield* write(ctx, AUDIT_JSON, json(audit))
          yield* write(ctx, AUDIT_MD, renderAudit(audit))
          return { notes: `${findings.length} findings` }
        }),
    },
  ],
  check: (ctx) =>
    Effect.gen(function* () {
      const x = yield* analyse(ctx, 'check')
      const row = (id: string, found: readonly Finding[], ok: string): CheckResult => ({
        id,
        ok: errors(found).length === 0,
        detail: detailOf(found, ok),
      })
      const results: CheckResult[] = [
        row('lint', x.lint.narrative, 'canon, tone, nouns and beats are clean'),
        row('dialogue', x.lint.dialogue, 'every conversation reaches its exit'),
        row('deck', x.lint.deck, 'every storylet can fire'),
        row('beats', x.coverage.findings, `${x.coverage.routes.length} routes deliver every required beat`),
        row('hints', x.coverage.hints.findings, 'every lethal rule hinted before its risk'),
        row('help', x.help, 'three hints per puzzle, three clues per deduction'),
      ]
      for (const [id, path, fresh] of [
        ['screenplay', SCREENPLAY, x.screenplay],
        ['help-doc', HELP_DOC, x.helpDoc],
      ] as const) {
        const status = yield* docStatus(ctx, path, fresh)
        results.push({ id, ok: status.ok, detail: status.detail })
      }
      return results
    }),
})
