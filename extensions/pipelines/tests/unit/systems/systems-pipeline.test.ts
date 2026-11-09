// The `systems` pipeline through the platform's router on a temporary scene folder: the spec
// parses, `run` writes the reports and is cached the second time, `check` rates every fairness row and claim.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Effect, Layer } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { systemsPipeline, systemsPipeSpec } from '#src/features/systems/systems-pipeline.ts'
import { FilesLive } from '#src/shared/node/files.ts'
import { ProcessRunnerLive } from '#src/shared/node/process.ts'
import { PIPE_POLICIES } from '#src/shared/policies.ts'
import { route } from '#src/shared/router.ts'

const resolve = createRequire(import.meta.url).resolve
const WARD = resolve('@automata/systems/testing/ward-scene.pipe')
const STRICT = resolve('@automata/systems/testing/ward-scene-strict.pipe')
const temps: string[] = []
afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true })
})
/** A scene folder: its scene module (re-exporting `module`'s scene), its spec, and a `pipeline.toml`. */
function folder(module: string, spec: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'pipe-systems-'))
  temps.push(dir)
  writeFileSync(join(dir, 'pipeline.toml'), '[budget]\n')
  writeFileSync(
    join(dir, 'scene.ts'),
    `export { scene } from ${JSON.stringify(pathToFileURL(module).href)}\n`,
  )
  writeFileSync(join(dir, 'systems.pipe.toml'), `scene = "./scene.ts"\n${spec}`)
  return dir
}
const layers = Layer.mergeAll(FilesLive, ProcessRunnerLive)
const pipe = (...argv: string[]) =>
  Effect.runPromise(Effect.provide(route([...argv, '--json'], [systemsPipeline], []), layers)).then(
    (out) => ({
      exit: out.exit,
      json: JSON.parse(out.stdout) as Record<string, unknown>,
    }),
  )

describe('systems.pipe.toml', () => {
  it("takes the bots' policies", async () => {
    expect(PIPE_POLICIES).toEqual((await import('@automata/systems/bots')).POLICIES)
  })

  it('parses a scene module, seeds, policies and a sweep; an unknown policy and a sweep of no steps fail at their path', () => {
    expect(systemsPipeSpec.safeParse({ scene: './scene.ts', seeds: 2, policies: ['scripted'] }).success).toBe(
      true,
    )
    const bad = systemsPipeSpec.safeParse({
      scene: './scene.ts',
      policies: ['lazy'],
      sweep: { tunable: 'x', from: 1, to: 2, steps: 0 },
    })
    expect(bad.success ? [] : bad.error.issues.map((i) => i.path)).toEqual([
      ['policies', 0],
      ['sweep', 'steps'],
    ])
  })
})

describe('automata pipe systems', () => {
  it('runs the scenarios, the playtest and the sweep, is cached the second time, and checks fairness and claims', async () => {
    const dir = folder(
      WARD,
      'seeds = 1\npolicies = ["scripted"]\n\n[sweep]\ntunable = "watchmanHunt"\nfrom = 1\nto = 2\nsteps = 2\n',
    )
    const first = await pipe('systems', 'run', dir)
    expect(first.exit).toBe(0)
    for (const report of ['reports/scenarios.json', 'reports/playtest.json', 'reports/sweep.json'])
      expect(existsSync(join(dir, report)), report).toBe(true)
    const scenarios = JSON.parse(readFileSync(join(dir, 'reports/scenarios.json'), 'utf8')) as {
      id: string
      ok: boolean
    }[]
    expect(scenarios.map((s) => [s.id, s.ok])).toEqual([
      ['bottleLure', true],
      ['seenInCorridor', true],
    ])
    const again = await pipe('systems', 'run', dir)
    // Nothing changed: every stage is skipped (the stage cache).
    expect((again.json.stages as { state: string }[]).map((s) => s.state)).toEqual([
      'skipped',
      'skipped',
      'skipped',
    ])
    const check = await pipe('systems', 'check', dir)
    const findings = JSON.stringify(check.json)
    for (const id of [
      'fairness:cautiousWin',
      'fairness:telegraph',
      'claim:watchmanLured',
      'scenario:bottleLure',
    ])
      expect(findings).toContain(id)
  })

  it('fails check on a missed fairness row, with its number', async () => {
    const dir = folder(STRICT, 'seeds = 1\npolicies = ["scripted"]\n')
    await pipe('systems', 'run', dir)
    const check = await pipe('systems', 'check', dir)
    expect(check.exit).not.toBe(0)
    const checks = (check.json.data as { checks: { id: string; ok: boolean; detail: string }[] }).checks
    expect(checks.find((c) => c.id === 'fairness:cautiousWin')).toEqual({
      id: 'fairness:cautiousWin',
      ok: false,
      detail: 'cautious-bot win rate: 1 ≥ 1.01 (1/1 all runs won)',
    })
  })
})
