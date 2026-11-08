import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { expect, test } from '@playwright/test'
import { BASE_3D, EMBERWICK } from '../harness/fixtures.ts'
import { newGame } from '../harness/new-game.ts'

// A new game is made to be changed: its own files must typecheck and its own tests must pass the moment it is made, in
// the 2D game (a keeper, a cutscene and a guard come with it where the workspace has them) and the 3D one. The game links
// this checkout's packages by their sources, which a game's NodeNext resolution cannot read (no extension on their own
// imports), so `tsc` reads them the way Vite does (bundler resolution); a type error inside one of them is the package's
// to report (`pnpm check` does), and this reads only the lines about the game's own files. One project runs it: the answer does not depend on a screen.

const run = promisify(execFile)

/** The game's own paths in `tsc`'s output (`src/x.ts(1,2): error TS...`), and nothing from a linked package. */
const OWN = /^(?:src|tests|content|ship\.config|vite\.config|vitest\.config)[^\s(]*\(\d+,\d+\): error /

/** What `tsc` says about the game's own files; the empty list is a clean game. */
async function ownTypeErrors(dir: string): Promise<string[]> {
  const tsc = 'node_modules/typescript/bin/tsc'
  const { stdout } = await run(
    process.execPath,
    [tsc, '-p', '.', '--noEmit', '--pretty', 'false', '--module', 'esnext', '--moduleResolution', 'bundler'],
    {
      cwd: dir,
      maxBuffer: 32 * 1024 * 1024,
    },
  ).catch((failed: { stdout?: string }) => ({ stdout: failed.stdout ?? '' }))
  return stdout.split('\n').filter((line) => OWN.test(line))
}

for (const [name, template, installedFrom] of [
  ['the 2D game', '2d', EMBERWICK],
  ['the 3D game', '3d', BASE_3D],
] as const) {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright reads the fixtures from a destructured first argument, and this test uses none.
  test(`${name} typechecks and passes its own tests as made`, async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'editor-ipad-chromium', 'the answer does not depend on a screen')
    test.setTimeout(240_000)
    const game = await newGame(installedFrom, template, 'my-game', true)
    try {
      expect(await ownTypeErrors(game.dir)).toEqual([])
      const tests = await run(
        process.execPath,
        ['node_modules/vitest/vitest.mjs', 'run', '--configLoader', 'runner'],
        {
          cwd: game.dir,
          maxBuffer: 32 * 1024 * 1024,
        },
      ).catch((failed: { stdout?: string; stderr?: string }) => {
        throw new Error(`the new game's tests fail:\n${failed.stdout ?? ''}\n${failed.stderr ?? ''}`)
      })
      expect(tests.stdout).toContain('passed')
    } finally {
      game.remove()
    }
  })
}
