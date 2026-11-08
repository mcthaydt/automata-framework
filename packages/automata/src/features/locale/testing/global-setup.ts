// Vitest global setup (Node): compiles the Paraglide fixture once and hands its folder to the test files.

import { rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'
import { compileFixture } from './compile-fixture.js'

declare module 'vitest' {
  export interface ProvidedContext {
    /** The folder with the compiled fixture's `runtime.js` and `messages.js`. */
    paraglideFixture: string
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const outdir = await compileFixture(
    fileURLToPath(new URL('../../../../node_modules/.cache/af-paraglide-fixture', import.meta.url)),
  )
  project.provide('paraglideFixture', outdir)
  return () => rm(dirname(outdir), { recursive: true, force: true })
}
