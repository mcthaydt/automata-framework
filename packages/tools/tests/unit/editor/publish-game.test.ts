import { describe, expect, it } from 'vitest'
import { type PublishStep, publishGame } from '#src/features/editor/publish-game.ts'

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

const deps = (run: (step: PublishStep) => Promise<{ code: number; output: string }>) => ({
  vite: '/games/my-game/node_modules/vite/bin/vite.js',
  bin: '/tools/dist/bin.js',
  run,
})

describe('publishGame', () => {
  it('builds the game for the web, then checks and zips the build, and names the zip', async () => {
    const { ran, run } = steps([
      { code: 0, output: 'built in 2s' },
      { code: 0, output: 'wrote /games/my-game/my-game-0.1.0-itch.zip\n' },
    ])
    expect(await publishGame('/games/my-game', deps(run))).toEqual({
      ok: true,
      file: '/games/my-game/my-game-0.1.0-itch.zip',
    })
    expect(ran).toEqual([
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
    const { ran, run } = steps([{ code: 1, output: 'src/main.ts:3: Unexpected token' }])
    expect(await publishGame('/games/my-game', deps(run))).toEqual({
      ok: false,
      problem: 'Your game did not build. Fix what the lines below say, then try again.',
      detail: 'src/main.ts:3: Unexpected token',
    })
    expect(ran).toHaveLength(1)
  })

  it('passes on what the check found when the build is not ready to put online', async () => {
    const { run } = steps([
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
