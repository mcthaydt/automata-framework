import { defineTests, type TestOptions } from '@automata/vitest-preset'
import type { BrowserCommand } from 'vitest/node'
import type { MotionLibrary } from './src/features/figures/clips/figure-state.ts'
import type { FigureLibrary } from './src/features/figures/figure/build.ts'
import type { FigureDef } from './src/features/figures/figure/figure.schema.ts'
import type { fixtureFigures } from './src/testing/fixture-library.ts'
import type { fixtureMotion } from './src/testing/fixture-motion.ts'

// `tests/unit`: the parsers, the views' maths, the figures' rig, genes and content checks, the no-eval shim's pin and
// the bundle guard, on Node. `tests/browser`: the renderer on a real WebGL2 context and the figures' goldens again in
// Chromium, WebKit and Firefox, so they hold in four engines (`tests/unit` runs the same golden checks in Node).
// Headless Firefox in this container has no WebGL, so those cases skip there and the GPU runner runs them. The solve
// bench in `tests/bench` measures and never asserts (`pnpm bench`).
//
// Svelte compiles the runtime's screens, which the renderer's tests reach through `@automata/framework`.
//
// `figureFixture` compiles the fixture content in Node (the content compiler reads files) and hands a browser page its
// library; build() itself then runs in the page. The fixture loads through the project's Vite module runner, which
// resolves the workspace's TypeScript sources (this config is loaded by Node, which does not).
const figureFixture: BrowserCommand<[], FigureLibrary> = async (ctx) => {
  const fixture = await ctx.project.import<{ fixtureFigures: typeof fixtureFigures }>(
    './src/testing/fixture-library.ts',
  )
  return (await fixture.fixtureFigures()).library
}

// Wick with the libraries he is built and played from, for a page that draws him through the renderer.
export interface WickFixture {
  readonly wick: FigureDef
  readonly library: FigureLibrary
  readonly motion: MotionLibrary
}
const wickFixture: BrowserCommand<[], WickFixture> = async (ctx) => {
  const figures = await ctx.project.import<{ fixtureFigures: typeof fixtureFigures }>(
    './src/testing/fixture-library.ts',
  )
  const motion = await ctx.project.import<{ fixtureMotion: typeof fixtureMotion }>(
    './src/testing/fixture-motion.ts',
  )
  const [{ library }, { library: played, wick }] = await Promise.all([
    figures.fixtureFigures(),
    motion.fixtureMotion(),
  ])
  return { wick, library, motion: played }
}

// The painter's oracle frames, as Node paints them, for a page that paints the same ones and compares: each frame's
// input over the wire and the hash of the cell Node made (the unit tests hold Node's cells to the oracle's bytes).
export interface PaintedWire {
  readonly id: string
  readonly input: string
  readonly hash: string
}
const WIRED = ['base-m-D1-stand-45', 'base-m-D1-hero', 'base-m-D2-hero', 'base-f-D2-walk3-90']
const paintedCells: BrowserCommand<[], PaintedWire[]> = async (ctx) => {
  const oracles =
    await ctx.project.import<typeof import('./src/testing/oracles.ts')>('./src/testing/oracles.ts')
  const inputs = await ctx.project.import<typeof import('./tests/unit/figures/paint/cell-input.ts')>(
    './tests/unit/figures/paint/cell-input.ts',
  )
  const paint = await ctx.project.import<typeof import('./src/features/figures/paint/paint-cell.ts')>(
    './src/features/figures/paint/paint-cell.ts',
  )
  const wire = await ctx.project.import<typeof import('./src/testing/wire.ts')>('./src/testing/wire.ts')
  const { frames } = oracles.figureBuilderFrames()
  const out: PaintedWire[] = []
  for (const frame of frames.filter((f) => WIRED.includes(f.id))) {
    const input = inputs.inputOf(frame)
    out.push({ id: frame.id, input: wire.toWire(input), hash: await wire.cellHash(paint.paintCell(input)) })
  }
  return out
}

// A photo's PNG as base64, for a page that makes tiles from the library (the game fetches the same bytes by URL).
const photoFile: BrowserCommand<[string], string> = async (ctx, name) => {
  const files = await ctx.project.import<typeof import('./src/testing/photo-files.ts')>(
    './src/testing/photo-files.ts',
  )
  return Buffer.from(files.photoBytes(name)).toString('base64')
}

// Pre-bundled browser-side deps: on a cold cache Vite otherwise reloads test pages mid-run (A0 spec §11).
const config: ReturnType<typeof defineTests> = defineTests({
  svelte: true,
  optimizeDeps: ['zod'],
  browserCommands: { figureFixture, wickFixture, paintedCells, photoFile } as NonNullable<
    TestOptions['browserCommands']
  >,
})
export default config
