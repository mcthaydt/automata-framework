// @vitest-environment node
import { fileURLToPath } from 'node:url'
import { resolveConfig } from 'vite'
import { describe, expect, it } from 'vitest'

const configFile = fileURLToPath(new URL('../../../playground/vite.config.ts', import.meta.url))

describe('the playground runtime build (playground/vite.config.ts)', () => {
  // The frame runs each example over Ruken's in-memory fake host (`ruken/harness.ts`), so the build takes the Ruken
  // adapter: with no AF condition, `@mcthaydt/automata-host/target` is the web adapter (DIST spec §5.3).
  it('builds for the ruken target', async () => {
    const config = await resolveConfig({ configFile, logLevel: 'silent' }, 'build')
    expect(config.resolve.conditions[0]).toBe('automata-ruken')
  })
})
