import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  type PublishStep,
  plainOutput,
  publishGame,
  runStep,
  scanBuildForEval,
} from '#src/features/editor/publish-game.ts'

// Publish in the editor: the game's own Vite builds it for the web, then `automata ship prepare --target itch` checks
// the build and zips it, so the person gets one file to upload to itch.io or any web host. The steps are recorded here;
// the editor's whole-loop journey runs them for real.

const steps = (answers: readonly { code: number; output: string }[]) => {
  const ran: PublishStep[] = []
  return {
    ran,
    run: async (step: PublishStep) => {
      ran.push(step)
      return answers[ran.length - 1] ?? { code: 0, output: '' }
    },
  }
}

const CLEAN = JSON.stringify({ ok: true, steps: [{ name: 'levels', ok: true, ms: 1, findings: [] }] })

const deps = (
  run: (step: PublishStep) => Promise<{ code: number; output: string }>,
  evalFindings: readonly string[] = [],
) => ({
  vite: '/games/my-game/node_modules/vite/bin/vite.js',
  bin: '/tools/dist/bin.js',
  run,
  evalFindings: async () => evalFindings,
})

/** The three answers of the checks that read the game's files, all clean, ahead of the build's and the zip's. */
const clean = [
  { code: 0, output: CLEAN },
  { code: 0, output: CLEAN },
  { code: 0, output: CLEAN },
]

describe('publishGame', () => {
  it('builds the game for the web, then checks and zips the build, and names the zip', async () => {
    const { ran, run } = steps([
      ...clean,
      { code: 0, output: 'built in 2s' },
      { code: 0, output: 'wrote /games/my-game/my-game-0.1.0-itch.zip\n' },
    ])
    expect(await publishGame('/games/my-game', deps(run))).toEqual({
      ok: true,
      file: '/games/my-game/my-game-0.1.0-itch.zip',
    })
    expect(ran).toEqual([
      ...['levels', 'inputs', 'orientation'].map((step) => ({
        args: ['/tools/dist/bin.js', 'check', '--only', step, '--json'],
        cwd: '/games/my-game',
      })),
      {
        args: [
          '/games/my-game/node_modules/vite/bin/vite.js',
          'build',
          '--mode',
          'itch',
          '--configLoader',
          'runner',
        ],
        cwd: '/games/my-game',
      },
      { args: ['/tools/dist/bin.js', 'ship', 'prepare', '--target', 'itch'], cwd: '/games/my-game' },
    ])
  })

  it('stops at a build that fails, and says so in plain words with the build’s last lines', async () => {
    const { ran, run } = steps([...clean, { code: 1, output: 'src/main.ts:3: Unexpected token' }])
    expect(await publishGame('/games/my-game', deps(run))).toEqual({
      ok: false,
      problem: 'Your game did not build. Fix what the lines below say, then try again.',
      detail: 'src/main.ts:3: Unexpected token',
    })
    expect(ran).toHaveLength(4)
  })

  it('passes on what the check found when the build is not ready to put online', async () => {
    const { run } = steps([
      ...clean,
      { code: 0, output: '' },
      { code: 1, output: 'A secret is in the build: dist/assets/index.js' },
    ])
    expect(await publishGame('/games/my-game', deps(run))).toEqual({
      ok: false,
      problem: 'Your game is not ready to put online yet. Fix what the lines below say, then try again.',
      detail: 'A secret is in the build: dist/assets/index.js',
    })
  })

  it('says to install the game’s packages when it has no Vite', async () => {
    const { ran, run } = steps([])
    expect(await publishGame('/games/my-game', { ...deps(run), vite: undefined })).toMatchObject({
      ok: false,
      problem:
        'Your game’s packages are not installed. Run pnpm install in its folder, then start the editor again.',
    })
    expect(ran).toEqual([])
  })
})

describe('publishGame checks before and after the build', () => {
  const failing = JSON.stringify({
    ok: false,
    steps: [
      {
        name: 'levels',
        ok: false,
        ms: 3,
        findings: [
          {
            file: 'content/levels/start.toml',
            line: 4,
            col: 1,
            rule: 'levels',
            message: 'is older than the level you saved',
          },
        ],
      },
    ],
  })

  it('stops before the build when a check of the game’s files finds something, and says what in plain words', async () => {
    const { ran, run } = steps([
      { code: 0, output: CLEAN },
      { code: 1, output: failing },
    ])
    const outcome = await publishGame('/games/my-game', deps(run))
    expect(outcome).toEqual({
      ok: false,
      problem:
        'Your game has something to fix before it can go online. Fix what the lines below say, then try again.',
      detail: 'content/levels/start.toml:4: is older than the level you saved',
    })
    expect(ran).toHaveLength(2)
  })

  it('says a check could not run, when the check says so', async () => {
    const broken = JSON.stringify({
      ok: false,
      steps: [
        {
          name: 'inputs',
          ok: false,
          ms: 0,
          findings: [
            { file: '', line: 0, col: 0, rule: 'tool-error', message: 'ship.config.ts could not be read' },
          ],
        },
      ],
    })
    const { run } = steps([{ code: 2, output: broken }])
    expect(await publishGame('/games/my-game', deps(run))).toMatchObject({
      ok: false,
      detail: 'ship.config.ts could not be read',
    })
  })

  it('does not say a file’s name twice when the message already starts with it', async () => {
    const named = JSON.stringify({
      ok: false,
      steps: [
        {
          name: 'levels',
          ok: false,
          ms: 1,
          findings: [
            {
              file: 'content/levels/start.toml',
              line: 0,
              col: 0,
              rule: 'levels',
              message:
                'content/levels/start.toml does not match start.af2d.json.\nOpen the level in the editor.',
            },
          ],
        },
      ],
    })
    const { run } = steps([{ code: 1, output: named }])
    expect(await publishGame('/games/my-game', deps(run))).toMatchObject({
      detail: 'content/levels/start.toml does not match start.af2d.json.\nOpen the level in the editor.',
    })
  })

  it('still stops when a check prints nothing it can read', async () => {
    const { run } = steps([{ code: 1, output: 'Segmentation fault' }])
    expect(await publishGame('/games/my-game', deps(run))).toMatchObject({
      ok: false,
      detail: 'Segmentation fault',
    })
  })

  it('stops at code that runs text as code, which web stores refuse, after the build and before the zip', async () => {
    const { ran, run } = steps([...clean, { code: 0, output: 'built' }])
    const outcome = await publishGame(
      '/games/my-game',
      deps(run, ['dist/assets/index.js:1:20  new Function(…)']),
    )
    expect(outcome).toEqual({
      ok: false,
      problem:
        'Part of your game runs text as code (eval), which itch.io and most web hosts do not allow. Fix what the lines below say, then try again.',
      detail: 'dist/assets/index.js:1:20  new Function(…)',
    })
    expect(ran).toHaveLength(4)
  })
})

describe('what a failed Publish shows', () => {
  it('has no colour codes and no stack frames, and keeps the line that matters', () => {
    const noisy = [
      '\u001b[31merror during build:\u001b[39m',
      '\u001b[38;5;246msrc/shared/constants.ts:9:14\u001b[39m Unexpected token',
      '    at Object.parse (/node_modules/rolldown/dist/index.js:12:3)',
      '    at async build (/node_modules/vite/dist/node/chunks/build.js:55:9)',
      '',
    ].join('\n')
    expect(plainOutput(noisy)).toBe('error during build:\nsrc/shared/constants.ts:9:14 Unexpected token')
  })

  it('keeps only the last lines of a long output', () => {
    const long = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n')
    expect(plainOutput(long).split('\n')).toHaveLength(20)
    expect(plainOutput(long).endsWith('line 49')).toBe(true)
  })

  it('asks the steps it runs to keep their colours to themselves', async () => {
    const ran = await runStep({
      args: ['-e', 'process.stdout.write(`${process.env.NO_COLOR}|${process.env.FORCE_COLOR}`)'],
      cwd: process.cwd(),
    })
    expect(ran).toEqual({ code: 0, output: '1|0' })
  })
})

describe('scanBuildForEval', () => {
  it('names the file, line and call, in words about the game and not about one store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-publish-eval-'))
    try {
      mkdirSync(join(dir, 'dist/assets'), { recursive: true })
      writeFileSync(join(dir, 'dist/assets/index.js'), "const run = new Function('return 1')\nrun()\n")
      writeFileSync(join(dir, 'dist/assets/other.js'), 'export const fine = 1\n')
      const found = await scanBuildForEval(dir)
      expect(found).toHaveLength(1)
      expect(found[0]).toMatch(/^dist\/assets\/index\.js:1:\d+ /)
      expect(found[0]).not.toContain('Ruken')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('finds nothing in a clean build, or when there is no build', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'af-publish-eval-'))
    try {
      expect(await scanBuildForEval(dir)).toEqual([])
      mkdirSync(join(dir, 'dist'))
      writeFileSync(join(dir, 'dist/index.js'), 'export const fine = 1\n')
      expect(await scanBuildForEval(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
