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

// The gates' sheets (tests/browser/painted/gate-sheets.test.ts) are written by the page through this command, into the folder
// `scripts/gate.ts` names; it does nothing outside a gate run.
const gateWrite: BrowserCommand<[name: string, base64: string], void> = async (_ctx, name, base64) => {
  const out = process.env.C7_GATE_OUT
  if (out === undefined) throw new Error('C7_GATE_OUT is not set: run the sheets through scripts/gate.ts')
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, name), Buffer.from(base64, 'base64'))
}

// Svelte compiles the runtime's screens, which the painted figures' renderer test reaches through `@automata/3d`.
export default defineTests({
  svelte: true,
  optimizeDeps: ['zod'],
  browserCommands: { kitFixture, gateWrite } as NonNullable<TestOptions['browserCommands']>,
})
