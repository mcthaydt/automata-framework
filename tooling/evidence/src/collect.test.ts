import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  AUTOMATA_CHECK_PENDING,
  buildEvidence,
  engineOf,
  goldensFromReports,
  packagesFromManifests,
  runFromEnv,
  type VitestJsonReport,
} from './collect.ts'
import { EvidenceSchema } from './evidence.schema.ts'

// Vitest's JSON reporter format, with the user agents Chromium, WebKit and Firefox reported on a real run
// (Playwright 1.63). The root is /repo.
const fixture = (): VitestJsonReport =>
  JSON.parse(readFileSync(new URL('./fixtures/goldens.report.json', import.meta.url), 'utf8'))

/** The fixture with one assertion changed: `edit` gets each assertion that recorded evidence. */
function edited(
  edit: (assertion: VitestJsonReport['testResults'][number]['assertionResults'][number]) => void,
): VitestJsonReport {
  const report = fixture()
  for (const file of report.testResults)
    for (const assertion of file.assertionResults) if (assertion.meta?.goldenEvidence) edit(assertion)
  return report
}

const evidenceOf = (assertion: { meta?: Record<string, unknown> }) =>
  assertion.meta?.goldenEvidence as { scenario: string; seed: number; runtime: { kind: string } }

describe('engineOf', () => {
  it('names Node and its version', () => {
    expect(engineOf({ kind: 'node', version: 'v24.21.0' })).toEqual({ engine: 'node', version: 'v24.21.0' })
  })

  it('names each browser and its version from its user agent', () => {
    const report = fixture()
    const browsers = report.testResults
      .filter((file) => file.name.endsWith('golden.parity.test.ts'))
      .map((file) => engineOf(evidenceOf(file.assertionResults[0] ?? {}).runtime as never))
    expect(browsers).toEqual([
      { engine: 'chromium', version: '153.0.8010.12' },
      { engine: 'webkit', version: '26.6' },
      { engine: 'firefox', version: '155.0' },
    ])
  })

  it('refuses a browser it cannot name', () => {
    expect(() => engineOf({ kind: 'browser', userAgent: 'Lynx/2.9' })).toThrow(/Lynx/)
  })
})

describe('goldensFromReports', () => {
  it('groups each scenario’s four engines, in engine order, with the files that ran it', () => {
    const goldens = goldensFromReports([fixture()], '/repo')
    expect(goldens.map((golden) => golden.scenario)).toEqual(['base-2d/golden-route', 'testing/bounce'])
    expect(goldens[0]).toEqual({
      scenario: 'base-2d/golden-route',
      seed: 1,
      ticks: 342,
      enginesAgree: true,
      sources: ['examples/base-2d/src/golden.parity.test.ts', 'examples/base-2d/src/golden.test.ts'],
      hashes: [
        { engine: 'node', version: 'v24.21.0', hash: '31f50888ccb4cf0a' },
        { engine: 'chromium', version: '153.0.8010.12', hash: '31f50888ccb4cf0a' },
        { engine: 'firefox', version: '155.0', hash: '31f50888ccb4cf0a' },
        { engine: 'webkit', version: '26.6', hash: '31f50888ccb4cf0a' },
      ],
    })
  })

  it('reads several reports (one per package) together', () => {
    const [first, ...rest] = fixture().testResults
    const one = { ...fixture(), testResults: first ? [first] : [] }
    const others = { ...fixture(), testResults: rest }
    expect(goldensFromReports([one, others], '/repo')).toEqual(goldensFromReports([fixture()], '/repo'))
  })

  it('says when the engines disagree, as the hashes do', () => {
    let changed = false
    const report = edited((assertion) => {
      const evidence = evidenceOf(assertion) as unknown as { scenario: string; hash: string }
      if (!changed && evidence.scenario === 'testing/bounce') {
        evidence.hash = '0000000000000000'
        changed = true
      }
    })
    const bounce = goldensFromReports([report], '/repo').find(
      (golden) => golden.scenario === 'testing/bounce',
    )
    expect(bounce?.enginesAgree).toBe(false)
  })

  it('refuses a golden test that did not pass', () => {
    const report = edited((assertion) => {
      if (evidenceOf(assertion).scenario === 'testing/bounce') assertion.status = 'failed'
    })
    expect(() => goldensFromReports([report], '/repo')).toThrow(/testing\/bounce.*failed/)
  })

  it('refuses a scenario that is missing an engine', () => {
    const report = fixture()
    report.testResults = report.testResults.filter(
      (file) =>
        !file.assertionResults.some(
          (assertion) =>
            evidenceOf(assertion)?.scenario === 'testing/bounce' &&
            evidenceOf(assertion).runtime.kind === 'node',
        ),
    )
    expect(() => goldensFromReports([report], '/repo')).toThrow(/testing\/bounce.*node/)
  })

  it('refuses an engine that reported one scenario twice', () => {
    const report = fixture()
    const first = report.testResults[0]
    if (first) report.testResults.push(first)
    expect(() => goldensFromReports([report], '/repo')).toThrow(/testing\/bounce.*node.*twice/)
  })

  it('refuses a seed that differs between engines', () => {
    let changed = false
    const report = edited((assertion) => {
      if (!changed && evidenceOf(assertion).scenario === 'base-2d/golden-route') {
        evidenceOf(assertion).seed = 2
        changed = true
      }
    })
    expect(() => goldensFromReports([report], '/repo')).toThrow(/base-2d\/golden-route.*seed/)
  })

  it('refuses evidence that is not the recorded shape, naming the test', () => {
    const report = edited((assertion) => {
      ;(evidenceOf(assertion) as unknown as { hash: string }).hash = 'not a hash'
    })
    expect(() => goldensFromReports([report], '/repo')).toThrow(/bounce\.golden\.test\.ts/)
  })

  it('refuses reports with no goldens at all', () => {
    const report = { ...fixture(), testResults: [] }
    expect(() => goldensFromReports([report], '/repo')).toThrow(/no golden/)
  })
})

describe('packagesFromManifests', () => {
  const tags = ['@mcthaydt/automata-sim@0.0.1', '@mcthaydt/automata-sim@0.0.2']

  it("marks a version released when Changesets' release tag for it exists", () => {
    expect(
      packagesFromManifests(
        [
          { name: '@mcthaydt/automata-sim', version: '0.0.2' },
          { name: '@mcthaydt/automata-render-pixi', version: '0.0.1' },
        ],
        tags,
      ),
    ).toEqual([
      { name: '@mcthaydt/automata-render-pixi', version: '0.0.1', released: false },
      { name: '@mcthaydt/automata-sim', version: '0.0.2', released: true },
    ])
  })

  it('refuses to say nothing was released when the checkout has no tags (fetch them)', () => {
    expect(() => packagesFromManifests([{ name: '@mcthaydt/automata-sim', version: '0.0.2' }], [])).toThrow(
      /tags/,
    )
  })
})

describe('runFromEnv', () => {
  const actions = {
    GITHUB_ACTIONS: 'true',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'mcthaydt/automata-framework',
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_WORKFLOW: 'ci',
    GITHUB_JOB: 'parity',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/main',
  }

  it("reads a GitHub Actions run, with the run attempt's URL", () => {
    expect(runFromEnv(actions)).toEqual({
      kind: 'ci',
      url: 'https://github.com/mcthaydt/automata-framework/actions/runs/123/attempts/2',
      id: '123',
      attempt: 2,
      workflow: 'ci',
      job: 'parity',
      event: 'push',
      ref: 'refs/heads/main',
    })
  })

  it('refuses an Actions run with a variable missing', () => {
    expect(() => runFromEnv({ ...actions, GITHUB_RUN_ID: undefined })).toThrow(/GITHUB_RUN_ID/)
  })

  it('is a local run outside GitHub Actions', () => {
    expect(runFromEnv({})).toEqual({ kind: 'local' })
  })
})

describe('buildEvidence', () => {
  const inputs = {
    generatedAt: new Date('2026-10-16T12:00:00Z'),
    revision: { sha: '71c3410aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', dirty: false },
    run: { kind: 'local' } as const,
    playwright: '1.63.0',
    goldens: goldensFromReports([fixture()], '/repo'),
    packages: [{ name: '@mcthaydt/automata-sim', version: '0.0.2', released: true }],
  }

  it('assembles a file the schema accepts, with the automata check pending on DX.5 and DX.6', () => {
    const evidence = buildEvidence(inputs)
    expect(EvidenceSchema.parse(evidence)).toEqual(evidence)
    expect(evidence.generatedAt).toBe('2026-10-16T12:00:00.000Z')
    expect(evidence.automataCheck).toEqual(AUTOMATA_CHECK_PENDING)
    expect(AUTOMATA_CHECK_PENDING.waitingOn).toEqual(['DX.5', 'DX.6'])
  })

  it('refuses a revision that is not a full commit hash', () => {
    expect(() => buildEvidence({ ...inputs, revision: { sha: 'main', dirty: false } })).toThrow()
  })
})
