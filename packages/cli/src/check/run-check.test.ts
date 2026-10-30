import { FileError, Files, ProcessRunner, type RunResult } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'
import { exitCodeFor, type StepResult } from './check-report.ts'
import { CheckToolError, CspProbe, type CspProbeResult } from './csp-probe.ts'
import { runCheck } from './run-check.ts'

const GAME = '/work/game'
const BIN = `${GAME}/node_modules/.bin`
const VITEST_REPORT = `${GAME}/node_modules/.cache/automata-check/vitest.json`

const ok: RunResult = { exitCode: 0, stdout: '', stderr: '' }
const passingVitest = JSON.stringify({ numFailedTests: 0, testResults: [] })

interface FakeGame {
  /** Files that exist, with their text. Folders exist when a file is below them. */
  readonly files: Map<string, string>
  /** The answer for each tool, by bin name; a tool not listed is "not installed" (no bin file). */
  readonly tools: Record<string, ((args: readonly string[]) => RunResult) | undefined>
  readonly csp?: CspProbeResult | CheckToolError
  readonly ran: string[]
}

function fakeGame(overrides: Partial<Omit<FakeGame, 'ran'>> = {}): FakeGame {
  const files = new Map<string, string>([
    [`${GAME}/src/sim/game.plugin.ts`, ''],
    [`${GAME}/dist/index.html`, '<script src="./assets/index.js"></script>'],
    [`${GAME}/dist/assets/index.js`, 'export const x = 1'],
  ])
  for (const [path, text] of overrides.files ?? []) files.set(path, text)
  return {
    files,
    // Overrides replace the passing defaults; `undefined` uninstalls a tool.
    tools: {
      'automata-check-boundaries': () => ok,
      tsc: () => ok,
      vitest: () => {
        files.set(VITEST_REPORT, passingVitest)
        return ok
      },
      vite: () => ok,
      ...overrides.tools,
    },
    csp: overrides.csp ?? { ready: true, state: 'ready', violations: [] },
    ran: [],
  }
}

function layers(game: FakeGame) {
  const runner = Layer.succeed(ProcessRunner, {
    run: (command, args) =>
      Effect.sync(() => {
        const name = command.slice(BIN.length + 1)
        game.ran.push([name, ...args].join(' '))
        const tool = game.tools[name]
        if (tool === undefined) throw new Error(`fake: ${command} was run but is not installed`)
        return tool(args)
      }),
  })
  const below = (dir: string) => [...game.files.keys()].filter((path) => path.startsWith(`${dir}/`))
  const readText = (path: string) =>
    game.files.has(path)
      ? Effect.succeed(game.files.get(path) as string)
      : Effect.fail(new FileError({ path, cause: 'missing' }))
  const files = Layer.succeed(Files, {
    readText,
    readBytes: (path) => Effect.map(readText(path), (text) => new TextEncoder().encode(text)),
    writeText: (path, text) => Effect.sync(() => void game.files.set(path, text)),
    exists: (path) =>
      Effect.succeed(
        game.files.has(path) ||
          below(path).length > 0 ||
          (path.startsWith(`${BIN}/`) && game.tools[path.slice(BIN.length + 1)] !== undefined),
      ),
    listFiles: (dir) => Effect.succeed(below(dir).map((path) => path.slice(dir.length + 1))),
    remove: (path) => Effect.sync(() => void game.files.delete(path)),
  })
  const csp = Layer.succeed(CspProbe, {
    run: () =>
      game.csp instanceof CheckToolError ? Effect.fail(game.csp) : Effect.succeed(game.csp as CspProbeResult),
  })
  return Layer.mergeAll(runner, files, csp)
}

const options = { gameDir: GAME, simOnly: false, csp: false, failFast: false }

async function check(game: FakeGame, extra: Partial<typeof options> = {}) {
  const report = await Effect.runPromise(Effect.provide(runCheck({ ...options, ...extra }), layers(game)))
  return { report, names: report.steps.map((step: StepResult) => step.name), code: exitCodeFor(report) }
}

describe('runCheck', () => {
  it('runs boundaries, typecheck, test, boards, orientation, inputs, no-eval, secrets and data-urls in order, and passes a clean game', async () => {
    const game = fakeGame()
    const { report, names, code } = await check(game)
    expect(names).toEqual([
      'boundaries',
      'typecheck',
      'test',
      'boards',
      'orientation',
      'inputs',
      'no-eval',
      'secrets',
      'data-urls',
    ])
    expect(report.ok).toBe(true)
    expect(code).toBe(0)
    expect(game.ran).toEqual([
      'automata-check-boundaries src/sim',
      'tsc -p . --noEmit --pretty false',
      `vitest run --reporter=json --outputFile=${VITEST_REPORT} --includeTaskLocation`,
      'vite build',
    ])
  })

  it('--sim-only skips the build; csp runs only with --csp', async () => {
    expect((await check(fakeGame(), { simOnly: true })).names).toEqual(['boundaries', 'typecheck', 'test'])
    expect((await check(fakeGame(), { simOnly: true, csp: true })).names).toEqual([
      'boundaries',
      'typecheck',
      'test',
    ])
    expect((await check(fakeGame(), { csp: true })).names).toEqual([
      'boundaries',
      'typecheck',
      'test',
      'boards',
      'orientation',
      'inputs',
      'no-eval',
      'secrets',
      'data-urls',
      'csp',
    ])
  })

  it('keeps going after findings, unless --fail-fast', async () => {
    const tools = {
      'automata-check-boundaries': () => ({
        exitCode: 1,
        stdout: 'src/sim/a.ts:1:1  import  import of "effect" is not allowed in the sim\n',
        stderr: '',
      }),
    }
    const all = await check(fakeGame({ tools }))
    expect(all.names).toEqual([
      'boundaries',
      'typecheck',
      'test',
      'boards',
      'orientation',
      'inputs',
      'no-eval',
      'secrets',
      'data-urls',
    ])
    expect(all.report.steps[0]?.findings).toEqual([
      {
        file: 'src/sim/a.ts',
        line: 1,
        col: 1,
        rule: 'import',
        message: 'import of "effect" is not allowed in the sim',
      },
    ])
    expect(all.code).toBe(1)

    const fast = await check(fakeGame({ tools }), { failFast: true })
    expect(fast.names).toEqual(['boundaries'])
    expect(fast.code).toBe(1)
  })

  it('a missing vitest is exit 2 with what to install, never a pass', async () => {
    const { report, code } = await check(fakeGame({ tools: { vitest: undefined } }))
    const test = report.steps.find((step) => step.name === 'test')
    expect(test).toMatchObject({ ok: false, toolError: true })
    expect(test?.findings[0]?.rule).toBe('tool-missing')
    expect(test?.findings[0]?.message).toContain('npm install --save-dev vitest')
    expect(code).toBe(2)
  })

  it('a game with neither src/sim nor sim role files is a tool error naming both layouts (GL spec B6)', async () => {
    const game = fakeGame()
    game.files.delete(`${GAME}/src/sim/game.plugin.ts`)
    game.files.set(`${GAME}/src/views.ts`, '')
    const { report, code } = await check(game)
    expect(report.steps[0]).toMatchObject({ name: 'boundaries', ok: false, toolError: true })
    expect(report.steps[0]?.findings[0]?.message).toContain('src/sim')
    expect(report.steps[0]?.findings[0]?.message).toContain('src/systems.ts')
    expect(code).toBe(2)
  })

  // The seven sim roles of the GL spec §4.5, as check-boundaries' GAME_SIM_ROLES lists them.
  it.each(['constants', 'components', 'commands', 'events', 'resources', 'systems', 'state'])(
    'a game laid out by role (src/%s) runs boundaries with --game src (GL spec B6)',
    async (role) => {
      for (const path of [`${role}.ts`, `${role}/a.ts`]) {
        const game = fakeGame()
        game.files.delete(`${GAME}/src/sim/game.plugin.ts`)
        game.files.set(`${GAME}/src/${path}`, '')
        const { report } = await check(game, { simOnly: true })
        expect(report.steps[0]).toMatchObject({ name: 'boundaries', ok: true })
        expect(game.ran[0]).toBe('automata-check-boundaries --game src')
      }
    },
  )

  it('a game with both layouts checks both in one run (GL spec B6)', async () => {
    const game = fakeGame({ files: new Map([[`${GAME}/src/sim.ts`, '']]) })
    await check(game, { simOnly: true })
    expect(game.ran[0]).toBe('automata-check-boundaries src/sim --game src')
  })

  it('reports type errors and failed tests as findings', async () => {
    const tools = {
      tsc: () => ({
        exitCode: 2,
        stdout: "src/main.ts(1,7): error TS2322: Type 'string' is bad.\n",
        stderr: '',
      }),
    }
    const game = fakeGame({ tools })
    game.tools.vitest = () => {
      game.files.set(
        VITEST_REPORT,
        JSON.stringify({
          testResults: [
            {
              name: `${GAME}/src/a.test.ts`,
              status: 'failed',
              message: '',
              assertionResults: [
                {
                  fullName: 'a',
                  status: 'failed',
                  location: { line: 2, column: 1 },
                  failureMessages: ['boom'],
                },
              ],
            },
          ],
        }),
      )
      return { exitCode: 1, stdout: '', stderr: '' }
    }
    const { report, code } = await check(game)
    expect(report.steps[1]?.findings.map((f) => f.rule)).toEqual(['TS2322'])
    expect(report.steps[2]?.findings).toEqual([
      { file: 'src/a.test.ts', line: 2, col: 1, rule: 'test', message: 'a: boom' },
    ])
    expect(code).toBe(1)
  })

  it('a tool that fails without findings is a tool error', async () => {
    const tools = { tsc: () => ({ exitCode: 1, stdout: '', stderr: 'tsc crashed' }) }
    const { report, code } = await check(fakeGame({ tools }))
    expect(report.steps[1]).toMatchObject({ name: 'typecheck', ok: false, toolError: true })
    expect(report.steps[1]?.findings[0]).toMatchObject({ rule: 'tool-error' })
    expect(report.steps[1]?.findings[0]?.message).toContain('tsc crashed')
    expect(code).toBe(2)
  })

  it('a failed build is a build finding; eval in the bundle is a no-eval finding', async () => {
    const broken = { vite: () => ({ exitCode: 1, stdout: '', stderr: 'Could not resolve "./x"' }) }
    const failedBuild = await check(fakeGame({ tools: broken }))
    expect(failedBuild.report.steps[6]?.findings).toEqual([
      { file: '', line: 0, col: 0, rule: 'build', message: 'vite build failed: Could not resolve "./x"' },
    ])
    expect(failedBuild.code).toBe(1)

    const withEval = fakeGame({
      files: new Map([[`${GAME}/dist/assets/index.js`, 'export const run = (s) => eval(s)']]),
    })
    const evalCheck = await check(withEval)
    expect(evalCheck.report.steps[6]?.findings).toMatchObject([
      { file: 'dist/assets/index.js', line: 1, rule: 'eval' },
    ])
    expect(evalCheck.code).toBe(1)
  })

  // M5 spec §4.8, L-b: the same board scan as `prepare-ruken`, over the game's sources, against the boards its
  // ship.config.ts declares under `leaderboards`.
  it('a board the sources name that ship.config.ts does not declare is a boards finding at its call site', async () => {
    const game = fakeGame({
      files: new Map([
        [
          `${GAME}/ship.config.ts`,
          "export default defineShipConfig({ leaderboards: { best: { order: 'desc', min: 0, max: 99 } } })\n",
        ],
        [
          `${GAME}/src/results.ts`,
          "export const go = (lb) => [lb.submitScore('best', 1), lb.readBoard('weekly')]\n",
        ],
      ]),
    })
    const { report, code } = await check(game)
    const boards = report.steps.find((step) => step.name === 'boards')
    expect(boards?.ok).toBe(false)
    expect(boards?.findings).toEqual([
      {
        file: 'src/results.ts',
        line: 1,
        col: 68,
        rule: 'undeclared-board',
        message: 'board "weekly" is not declared in ship.config.ts leaderboards',
      },
    ])
    expect(code).toBe(1)
  })

  // M4.7 follow-up: the orientation a `defineGame` plays in against the ship config's `runtime.orientation`, read
  // from the sources as the board scan reads them.
  describe('orientation', () => {
    const config = (orientation: string) =>
      `export default defineShipConfig({ runtime: { orientation: ${orientation} } })\n`
    const orientationStep = (report: Awaited<ReturnType<typeof check>>['report']) =>
      report.steps.find((step) => step.name === 'orientation')

    it('a game that plays in another orientation than the ship config declares is a finding at its literal', async () => {
      const game = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("'any'")],
          [`${GAME}/src/game.ts`, "export default defineGame({ orientation: 'landscape' })\n"],
        ]),
      })
      const { report, code } = await check(game)
      expect(orientationStep(report)?.ok).toBe(false)
      expect(orientationStep(report)?.findings).toEqual([
        {
          file: 'src/game.ts',
          line: 1,
          col: 42,
          rule: 'orientation-mismatch',
          message: 'defineGame plays "landscape", but ship.config.ts runtime.orientation is "any"',
        },
      ])
      expect(code).toBe(1)
    })

    it('a game that agrees with the ship config passes, and so does one that leaves orientation out against any', async () => {
      const agrees = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("'landscape'")],
          [`${GAME}/src/game.ts`, "export default defineGame({ orientation: 'landscape' })\n"],
        ]),
      })
      expect(orientationStep((await check(agrees)).report)?.ok).toBe(true)
      const defaults = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("'any'")],
          [`${GAME}/src/game.ts`, 'export default defineGame({ name: "x" })\n'],
        ]),
      })
      expect(orientationStep((await check(defaults)).report)?.ok).toBe(true)
    })

    it('a ship.config.ts whose orientation is not a literal is a tool error that says so', async () => {
      const game = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config('ORIENTATION')],
          [`${GAME}/src/game.ts`, "export default defineGame({ orientation: 'landscape' })\n"],
        ]),
      })
      const { report, code } = await check(game)
      expect(orientationStep(report)).toMatchObject({ ok: false, toolError: true })
      expect(orientationStep(report)?.findings[0]?.message).toContain('runtime.orientation in ship.config.ts')
      expect(code).toBe(2)
    })

    it('finds nothing without a ship.config.ts, without a defineGame, or in a test file', async () => {
      const noConfig = fakeGame({
        files: new Map([
          [`${GAME}/src/game.ts`, "export default defineGame({ orientation: 'landscape' })\n"],
        ]),
      })
      expect(orientationStep((await check(noConfig)).report)?.ok).toBe(true)
      const noGame = fakeGame({ files: new Map([[`${GAME}/ship.config.ts`, config('ORIENTATION')]]) })
      expect(orientationStep((await check(noGame)).report)?.ok).toBe(true)
      const inTest = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("'any'")],
          [`${GAME}/src/game.test.ts`, "const g = defineGame({ orientation: 'portrait' })\n"],
        ]),
      })
      expect(orientationStep((await check(inTest)).report)?.ok).toBe(true)
    })
  })

  // M4.1 follow-up: `runtime.inputs` against what the game's `keys()` calls bind, read from the sources.
  describe('inputs', () => {
    const config = (inputs: string) => `export default defineShipConfig({ runtime: { inputs: ${inputs} } })\n`
    const keysGame = (args: string) =>
      `import { keys } from '@mcthaydt/automata-game'\nexport const input = keys(${args})\n`
    const inputsStep = (report: Awaited<ReturnType<typeof check>>['report']) =>
      report.steps.find((step) => step.name === 'inputs')

    it("a pad binding the ship config leaves out is a finding at its inputs array, in the rule's own words", async () => {
      const game = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("['touch', 'keyboard']")],
          [`${GAME}/src/game.ts`, keysGame('Move, { KeyA: {} }, { pad: { 14: {} } }')],
        ]),
      })
      const { report, code } = await check(game)
      expect(inputsStep(report)?.ok).toBe(false)
      expect(inputsStep(report)?.findings).toEqual([
        {
          file: 'ship.config.ts',
          line: 1,
          col: 54,
          rule: 'inputs-mismatch',
          message: 'action "src/game.ts:2:22 pad" binds pad buttons but runtime.inputs has no "gamepad"',
        },
      ])
      expect(code).toBe(1)
    })

    it('touch declared with nothing to touch is a finding', async () => {
      const game = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("['touch', 'keyboard']")],
          [`${GAME}/src/game.ts`, keysGame('Move, { KeyA: {} }, { touch: false }')],
        ]),
      })
      expect(inputsStep((await check(game)).report)?.findings).toMatchObject([
        {
          file: 'ship.config.ts',
          rule: 'inputs-mismatch',
          message: 'runtime.inputs declares "touch" but no action binds a touch button or a gesture',
        },
      ])
    })

    it('a config that agrees passes', async () => {
      const game = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("['touch', 'gamepad', 'keyboard']")],
          [`${GAME}/src/game.ts`, keysGame('Move, { KeyA: {} }, { pad: { 14: {} } }')],
        ]),
      })
      expect(inputsStep((await check(game)).report)?.ok).toBe(true)
    })

    it('a ship.config.ts whose inputs are not literals is a tool error that says so', async () => {
      const game = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config('INPUTS')],
          [`${GAME}/src/game.ts`, keysGame('Move, { KeyA: {} }')],
        ]),
      })
      const { report, code } = await check(game)
      expect(inputsStep(report)).toMatchObject({ ok: false, toolError: true })
      expect(inputsStep(report)?.findings[0]?.message).toContain('runtime.inputs in ship.config.ts')
      expect(code).toBe(2)
    })

    it('finds nothing without a ship.config.ts, without a keys() call, or in a test file', async () => {
      const noConfig = fakeGame({
        files: new Map([[`${GAME}/src/game.ts`, keysGame('Move, { KeyA: {} }, { pad: { 14: {} } }')]]),
      })
      expect(inputsStep((await check(noConfig)).report)?.ok).toBe(true)
      const noKeys = fakeGame({ files: new Map([[`${GAME}/ship.config.ts`, config('INPUTS')]]) })
      expect(inputsStep((await check(noKeys)).report)?.ok).toBe(true)
      const inTest = fakeGame({
        files: new Map([
          [`${GAME}/ship.config.ts`, config("['touch']")],
          [`${GAME}/src/game.test.ts`, keysGame('Move, {}, { pad: { 14: {} } }')],
        ]),
      })
      expect(inputsStep((await check(inTest)).report)?.ok).toBe(true)
    })
  })

  // QB-b in `automata check`: the same scanner as `prepare-ruken`, over the dist/ the no-eval step built.
  it('a planted key in the bundle is a secrets finding with file, line and column, never the key', async () => {
    const key = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_')
    const planted = fakeGame({
      files: new Map([[`${GAME}/dist/assets/index.js`, `export const a = 1\nconst k = "${key}"`]]),
    })
    const { report, code } = await check(planted)
    const secrets = report.steps.find((step) => step.name === 'secrets')
    expect(secrets?.ok).toBe(false)
    expect(secrets?.findings).toEqual([
      {
        file: 'dist/assets/index.js',
        line: 2,
        col: 12,
        rule: 'secret-stripe-access-token',
        message: 'a Stripe key (sk_l…, 32 characters) at character 30',
      },
    ])
    expect(JSON.stringify(report)).not.toContain(key)
    expect(code).toBe(1)
  })

  it('secrets and data-urls do not scan a dist/ whose build failed: they say so instead of passing', async () => {
    const broken = { vite: () => ({ exitCode: 1, stdout: '', stderr: 'Could not resolve "./x"' }) }
    const { report } = await check(fakeGame({ tools: broken }))
    for (const [index, name] of [
      [7, 'secrets'],
      [8, 'data-urls'],
    ] as const) {
      expect(report.steps[index]).toMatchObject({
        name,
        ok: false,
        findings: [{ rule: 'build', message: 'not scanned: the build failed (see no-eval)' }],
      })
    }
  })

  // A no-eval that could not run (no vite installed) built nothing: the dist/ on disk is an earlier build's, and its
  // planted key and inlined asset must not be read as this game's.
  it('secrets and data-urls do not scan a dist/ when no-eval could not run: they say so instead of scanning it', async () => {
    const key = ['sk', 'live', '4eC39HqLyjWDarjtT1zdp7dc'].join('_')
    const stale = fakeGame({
      tools: { vite: undefined },
      files: new Map([
        [
          `${GAME}/dist/assets/index.js`,
          `const k = "${key}"\nconst s = new URL(\`data:image/png;base64,iVBO\`, \`\` + import.meta.url)`,
        ],
      ]),
    })
    const { report, code } = await check(stale)
    expect(report.steps[6]).toMatchObject({ name: 'no-eval', ok: false, toolError: true })
    for (const [index, name] of [
      [7, 'secrets'],
      [8, 'data-urls'],
    ] as const) {
      expect(report.steps[index]).toMatchObject({
        name,
        ok: false,
        findings: [
          { rule: 'build', message: 'not scanned: no-eval could not build or read dist/ (see no-eval)' },
        ],
      })
    }
    expect(code).toBe(2)
  })

  // DX.5a: an asset under Vite's assetsInlineLimit, inlined for `new URL(…, import.meta.url)`, which Ruken's CSP
  // refuses to fetch. The form is Vite 8's (data-url-scan.test.ts builds it for real).
  it('an asset inlined as a data: URL in the bundle is a data-urls finding at its new URL', async () => {
    const inlined = fakeGame({
      files: new Map([
        [
          `${GAME}/dist/assets/index.js`,
          'export const a = 1\nconst s = new URL(`data:image/png;base64,iVBORw0KGgo=`, `` + import.meta.url).href',
        ],
      ]),
    })
    const { report, code } = await check(inlined)
    const dataUrls = report.steps.find((step) => step.name === 'data-urls')
    expect(dataUrls?.ok).toBe(false)
    expect(dataUrls?.findings).toMatchObject([
      { file: 'dist/assets/index.js', line: 2, col: 11, rule: 'data-url' },
    ])
    expect(dataUrls?.findings[0]?.message).toContain('(image/png)')
    expect(code).toBe(1)
  })

  it('a CSP violation or no ready signal fails csp; a missing Playwright is exit 2', async () => {
    const violation = await check(
      fakeGame({ csp: { ready: true, state: 'ready', violations: ['script-src blocked eval'] } }),
      { csp: true },
    )
    expect(violation.report.steps[9]?.findings).toEqual([
      { file: '', line: 0, col: 0, rule: 'csp-violation', message: 'script-src blocked eval' },
    ])
    expect(violation.code).toBe(1)

    const notReady = await check(fakeGame({ csp: { ready: false, state: 'loading', violations: [] } }), {
      csp: true,
    })
    expect(notReady.report.steps[9]?.findings[0]).toMatchObject({ rule: 'not-ready' })
    expect(notReady.report.steps[9]?.findings[0]?.message).toContain('20 s')

    const failed = await check(fakeGame({ csp: { ready: false, state: 'failed', violations: [] } }), {
      csp: true,
    })
    expect(failed.report.steps[9]?.findings[0]).toMatchObject({ rule: 'boot-failed' })

    const missing = new CheckToolError({
      kind: 'missing',
      tool: 'playwright',
      detail: 'install it: npm install --save-dev playwright && npx playwright install chromium',
    })
    const noPlaywright = await check(fakeGame({ csp: missing }), { csp: true })
    expect(noPlaywright.report.steps[9]).toMatchObject({ ok: false, toolError: true })
    expect(noPlaywright.report.steps[9]?.findings[0]?.rule).toBe('tool-missing')
    expect(noPlaywright.code).toBe(2)
  })
})
