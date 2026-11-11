import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { callerProblems, type Workflow, workflowProblems } from '#src/workflow-invariants.ts'

// The repository's workflows keep the few rules that guard something real (where tokens go, which jobs skip drafts);
// each rule is also shown failing on a small workflow that breaks it, so a pass means the rule looked.

const WORKFLOWS = fileURLToPath(new URL('../../../../.github/workflows', import.meta.url))
const fixture = (text: string): readonly string[] => workflowProblems('fixture.yml', parse(text) as Workflow)

describe('the workflow invariants', () => {
  it('hold for every workflow in the repository', () => {
    const files = readdirSync(WORKFLOWS).filter((file) => file.endsWith('.yml'))
    expect(files.length).toBeGreaterThan(0)
    const workflows = Object.fromEntries(
      files.map((file) => [file, parse(readFileSync(join(WORKFLOWS, file), 'utf8')) as Workflow]),
    )
    const problems = [
      ...Object.entries(workflows).flatMap(([file, workflow]) => workflowProblems(file, workflow)),
      ...callerProblems(workflows),
    ]
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

  it("let the private submodules' read-only token reach a pull request's job, in the step that fetches them", () => {
    expect(
      fixture(`
on: [pull_request]
permissions: {}
jobs:
  checks:
    steps:
      - env: { SUBMODULES_TOKEN: '\${{ secrets.SUBMODULES_TOKEN }}' }
        run: git submodule update --init
`),
    ).toEqual([])
  })

  it('want the private submodules reset before a job installs, so a runner never keeps a stale checkout', () => {
    const job = (steps: string): string => `
on: [push]
permissions: {}
jobs:
  build:
    steps:
${steps}
`
    const reset = `      - env: { SUBMODULES_TOKEN: '\${{ secrets.SUBMODULES_TOKEN }}' }
        run: bash .github/scripts/checkout-submodules.sh
`
    const install = '      - run: pnpm install --frozen-lockfile\n'
    expect(fixture(job(install))).toEqual([
      'fixture.yml build: runs pnpm install without checking out the private submodules first',
    ])
    expect(fixture(job(install + reset))).toEqual([
      'fixture.yml build: runs pnpm install without checking out the private submodules first',
    ])
    expect(fixture(job(reset + install))).toEqual([])
    expect(fixture(job('      - run: pnpm lint\n'))).toEqual([])
  })

  it('want a job that calls a reusable workflow holding the submodule step to pass the token', () => {
    const callee = parse(`
on: { workflow_call: { secrets: { SUBMODULES_TOKEN: { required: false } } } }
permissions: {}
jobs: { game: { steps: [] } }
`) as Workflow
    const caller = (secrets: string): Workflow =>
      parse(`
on: [push]
permissions: {}
jobs:
  game:
    uses: ./.github/workflows/callee.yml
${secrets}
`) as Workflow
    const none = callerProblems({ 'callee.yml': callee, 'caller.yml': caller('') })
    expect(none).toEqual(['caller.yml game: calls callee.yml without passing SUBMODULES_TOKEN'])
    const passed = caller("    secrets: { SUBMODULES_TOKEN: '${{ secrets.SUBMODULES_TOKEN }}' }")
    expect(callerProblems({ 'callee.yml': callee, 'caller.yml': passed })).toEqual([])
    const inherited = caller('    secrets: inherit')
    expect(callerProblems({ 'callee.yml': callee, 'caller.yml': inherited })).toEqual([])
  })

  it('want a reusable workflow that uses the submodule token to declare it', () => {
    const workflow = (declared: string): string => `
on: { workflow_call: { ${declared} } }
permissions: {}
jobs:
  game:
    steps:
      - env: { SUBMODULES_TOKEN: '\${{ secrets.SUBMODULES_TOKEN }}' }
        run: bash .github/scripts/checkout-submodules.sh
`
    expect(fixture(workflow(''))).toEqual([
      'fixture.yml: uses SUBMODULES_TOKEN without declaring it under workflow_call secrets',
    ])
    expect(fixture(workflow('secrets: { SUBMODULES_TOKEN: { required: false } }'))).toEqual([])
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
