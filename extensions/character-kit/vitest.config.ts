import { defineTests, type TestOptions } from '@automata/vitest-preset'
import type { BrowserCommand } from 'vitest/node'

// `tests/unit`: the kit's registrations, pieces, seats, goldens and content, on Node. `tests/browser`: its geometry goldens
// again in Chromium, WebKit and Firefox, so they hold in four engines (the unit tests run the same checks in Node).
//
// The fixture library is compiled by the content compiler, which reads files, so the `kitFixture` command compiles it in
// Node and hands the page its data; build() then runs in the browser. The fixture loads through the project's Vite module
// runner, which resolves the workspace's TypeScript sources.
const kitFixture: BrowserCommand<[], unknown> = async (ctx) => {
  const fixture = await ctx.project.import<typeof import('./src/testing/kit-fixture.ts')>(
    './src/testing/kit-fixture.ts',
  )
  return (await fixture.kitFixture()).library
}

export default defineTests({
  optimizeDeps: ['zod'],
  browserCommands: { kitFixture } as NonNullable<TestOptions['browserCommands']>,
})
