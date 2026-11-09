import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { type Workflow, workflowProblems } from '#src/workflow-invariants.ts'

// The repository's workflows keep the few rules that guard something real (where tokens go, which jobs skip drafts);
// each rule is also shown failing on a small workflow that breaks it, so a pass means the rule looked.

const WORKFLOWS = fileURLToPath(new URL('../../../../.github/workflows', import.meta.url))
const fixture = (text: string): readonly string[] => workflowProblems('fixture.yml', parse(text) as Workflow)

describe('the workflow invariants', () => {
  it('hold for every workflow in the repository', () => {
    const files = readdirSync(WORKFLOWS).filter((file) => file.endsWith('.yml'))
    expect(files.length).toBeGreaterThan(0)
    const problems = files.flatMap((file) =>
      workflowProblems(file, parse(readFileSync(join(WORKFLOWS, file), 'utf8')) as Workflow),
    )
    expect(problems).toEqual([])
  })

  it('want top-level permissions', () => {
    expect(fixture('on: push\njobs: {}\n')).toEqual(['fixture.yml: sets no top-level permissions'])
  })

  it('refuse pull_request_target', () => {
    expect(fixture('on: [pull_request_target]\npermissions: {}\njobs: {}\n')).toContain(
      'fixture.yml: runs on pull_request_target',
    )
  })

  it('keep a secret to the step that uses it', () => {
    const problems = fixture(`
on: push
permissions: {}
env: { A: '\${{ secrets.ONE }}' }
jobs:
  build:
    env: { B: '\${{ secrets.TWO }}' }
    steps:
      - run: echo \${{ secrets.THREE }}
      - env: { C: '\${{ secrets.FOUR }}' }
        run: echo "$C"
`)
    expect(problems).toEqual([
      'fixture.yml: hands ONE to every job (workflow env)',
      'fixture.yml build: hands TWO to every step (job env)',
      "fixture.yml build: names THREE outside a step's env",
    ])
  })

  it('keep a publishing secret out of jobs a pull request can start, also in a reusable workflow', () => {
    const job = (condition: string): string => `
on: { workflow_call: {} }
permissions: {}
jobs:
  publish:
    if: ${condition}
    steps:
      - env: { TOKEN: '\${{ secrets.STORE_TOKEN }}', READ: '\${{ secrets.AF_READ_TOKEN }}' }
        run: publish
`
    expect(fixture(job('inputs.store'))).toEqual([
      'fixture.yml publish: a pull request can start the job that holds STORE_TOKEN',
    ])
    expect(
      fixture(
        job(
          "inputs.store && github.event_name != 'pull_request' && github.event_name != 'pull_request_target'",
        ),
      ),
    ).toEqual([])
  })

  it('make the heavy jobs skip draft pull requests, but not the light gate', () => {
    const problems = fixture(`
on: [pull_request]
permissions: {}
jobs:
  checks: { steps: [] }
  parity: { steps: [] }
  journeys: { if: "github.event.pull_request.draft != true", steps: [] }
  nightly: { if: "github.event_name == 'schedule'", steps: [] }
`)
    expect(problems).toEqual(['fixture.yml parity: runs on draft pull requests'])
  })
})

// The 3D workflow is the only gate for the 3D browser suites and journeys, so its shape is pinned: three jobs (the unit
// tests run in the core job of ci.yml, which `pnpm check` also runs) and a path filter that includes the vendored beta.
describe('the 3D workflow', () => {
  const workflow = parse(readFileSync(join(WORKFLOWS, '3d.yml'), 'utf8')) as {
    on: { pull_request: { paths: string[] } }
    jobs: Record<string, { name: string }>
  }

  it('has three jobs and runs on vendor changes', () => {
    expect(Object.values(workflow.jobs).map((job) => job.name)).toEqual([
      '3D - journeys',
      '3D - parity (chromium, webkit, firefox)',
      'base-3d through game-ci',
    ])
    expect(workflow.on.pull_request.paths).toEqual(
      expect.arrayContaining([
        'packages/**',
        'games/base-3d/**',
        'examples/3d/**',
        'vendor/pixi-3d/**',
        'agents/**',
        'pnpm-lock.yaml',
      ]),
    )
  })
})
