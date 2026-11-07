import { defineTests, type TestOptions } from '@automata/vitest-preset'
import type { BrowserCommand } from 'vitest/node'

// `tests/unit`: the wardrobe's goldens, random cast, stands and content bounds, on Node. `tests/browser`: its geometry
// goldens again in Chromium, WebKit and Firefox, so they hold in four engines (the unit tests run the same checks in Node).
//
// The fixture library is compiled by the content compiler, which reads files, so the `figureFixture` command compiles it in
// Node and hands the page its data; build() then runs in the browser. The fixture loads through the project's Vite module
// runner, which resolves the workspace's TypeScript sources.
const figureFixture: BrowserCommand<[], unknown> = async (ctx) => {
  const fixture = await ctx.project.import<typeof import('@automata/3d/testing')>('@automata/3d/testing')
  return (await fixture.fixtureFigures()).library
}

export default defineTests({
  optimizeDeps: ['zod'],
  browserCommands: { figureFixture } as NonNullable<TestOptions['browserCommands']>,
})
