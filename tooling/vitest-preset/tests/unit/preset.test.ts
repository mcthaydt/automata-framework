import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineTests } from '#src/index.ts'

// A project's own fields, whatever shape `projects` holds it in.
type Project = {
  extends?: boolean
  test: {
    name: string
    environment?: string
    include: string[]
    setupFiles?: string[]
    globalSetup?: string[]
    css?: boolean
    testTimeout?: number
    server?: { deps?: { inline?: RegExp[] } }
    browser?: {
      enabled: boolean
      headless: boolean
      commands?: Record<string, unknown>
      instances: { browser: string }[]
    }
  }
}

const projectsOf = (config: ReturnType<typeof defineTests>): Project[] =>
  (config.test?.projects ?? []) as unknown as Project[]
const named = (config: ReturnType<typeof defineTests>, name: string): Project => {
  const found = projectsOf(config).find((project) => project.test.name === name)
  if (!found) throw new Error(`no project named ${name}`)
  return found
}

afterEach(() => vi.unstubAllEnvs())

describe('defineTests', () => {
  it('returns a Node unit project and a three-engine browser project, with nothing else set', () => {
    const config = defineTests({})
    expect(projectsOf(config).map((project) => project.test.name)).toEqual(['unit', 'browser'])
    expect(named(config, 'unit').test).toMatchObject({
      environment: 'node',
      include: ['tests/unit/**/*.test.ts'],
    })
    const browser = named(config, 'browser').test
    expect(browser.include).toEqual(['tests/browser/**/*.test.ts'])
    expect(browser.browser).toMatchObject({ enabled: true, headless: true })
    expect(browser.browser?.instances.map((instance) => instance.browser)).toEqual([
      'chromium',
      'webkit',
      'firefox',
    ])
  })

  it('puts environment, setup files, css and timeout on the unit project only', () => {
    const config = defineTests({
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      globalSetup: ['./tests/global.ts'],
      css: true,
      testTimeout: 90_000,
    })
    expect(named(config, 'unit').test).toMatchObject({
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      globalSetup: ['./tests/global.ts'],
      css: true,
      testTimeout: 90_000,
    })
    expect(named(config, 'browser').test.environment).toBeUndefined()
    expect(named(config, 'browser').test.setupFiles).toBeUndefined()
  })

  it('adds the Svelte plugin and the browser resolve condition for svelte: true', () => {
    const plain = defineTests({})
    expect(plain.plugins ?? []).toHaveLength(0)
    const svelte = defineTests({ svelte: true })
    expect((svelte.plugins ?? []).flat().length).toBeGreaterThan(0)
    expect(svelte.resolve?.conditions).toEqual(['browser'])
  })

  it('keeps extra plugins and resolve conditions, with the browser condition first when svelte is on', () => {
    const config = defineTests({ svelte: true, conditions: ['automata-ruken'], plugins: [{ name: 'extra' }] })
    expect(config.resolve?.conditions).toEqual(['automata-ruken', 'browser'])
    const names = (config.plugins ?? []).flat().map((plugin) => (plugin as { name: string }).name)
    expect(names).toContain('extra')
  })

  it('runs only the engines asked for, and no browser project for []', () => {
    const one = defineTests({ browsers: ['chromium'] })
    expect(named(one, 'browser').test.browser?.instances).toEqual([{ browser: 'chromium' }])
    const none = defineTests({ browsers: [] })
    expect(projectsOf(none).map((project) => project.test.name)).toEqual(['unit'])
  })

  it('hands browserCommands to the browser project', () => {
    const commands = { readGolden: () => null }
    const config = defineTests({ browserCommands: commands })
    expect(named(config, 'browser').test.browser?.commands).toBe(commands)
  })

  it('lists optimizeDeps so a cold cache does not reload pages mid-run', () => {
    expect(defineTests({ optimizeDeps: ['koota', 'zod'] }).optimizeDeps?.include).toEqual(['koota', 'zod'])
    expect(defineTests({}).optimizeDeps).toBeUndefined()
  })

  it('also runs the listed browser tests in Node, so a golden is checked in four engines', () => {
    const config = defineTests({ alsoInNode: ['tests/browser/sim/**/*.test.ts'] })
    expect(named(config, 'unit').test.include).toEqual([
      'tests/unit/**/*.test.ts',
      'tests/browser/sim/**/*.test.ts',
    ])
  })

  it('adds a bench project only when AF_BENCH is set', () => {
    expect(projectsOf(defineTests({})).map((project) => project.test.name)).not.toContain('bench')
    vi.stubEnv('AF_BENCH', '1')
    const config = defineTests({})
    expect(named(config, 'bench').test).toMatchObject({
      environment: 'node',
      include: ['tests/bench/**/*.test.ts'],
    })
  })

  it('has the unit project inherit the shared plugins and conditions', () => {
    for (const project of projectsOf(defineTests({ svelte: true }))) expect(project.extends).toBe(true)
  })
})
