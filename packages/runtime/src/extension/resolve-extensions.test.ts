import type { ContentSchemaDef } from '@mcthaydt/automata-content'
import { Hosting } from '@mcthaydt/automata-host'
import { HostingTest, runScoped } from '@mcthaydt/automata-host/testing'
import type { PluginDef } from '@mcthaydt/automata-sim'
import type { UiComponent } from '@mcthaydt/automata-ui'
import { Context, Effect, Layer } from 'effect'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { defineExtension, type ExtensionDef, type GameConfig } from './define-extension'
import { ExtensionError } from './extension-error'
import { resolveExtensions } from './resolve-extensions'

// Extensions are defined inline: test files are exempt from the `*.extension.ts` role rule.
const ext = (name: string, requires: string[] = []): ExtensionDef => defineExtension({ name, requires })

const config = {} as GameConfig

/** Runs `resolve` and returns what it threw, so a test can inspect the ExtensionError. */
function thrownBy(resolve: () => unknown): unknown {
  try {
    resolve()
  } catch (error) {
    return error
  }
  throw new Error('expected a throw')
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]]
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [item, ...rest]),
  )
}

describe('order', () => {
  it('orders by requires, ties by name', () => {
    const resolved = resolveExtensions([ext('c', ['a']), ext('b'), ext('a')])

    expect(resolved.order).toEqual(['a', 'b', 'c'])
  })

  it('gives the same order for every permutation of the input array', () => {
    const defs = [ext('c', ['a']), ext('b'), ext('a'), ext('d', ['c', 'b'])]

    for (const permutation of permutations(defs)) {
      expect(resolveExtensions(permutation).order).toEqual(['a', 'b', 'c', 'd'])
    }
  })

  it('has an empty order for no extensions', () => {
    expect(resolveExtensions([]).order).toEqual([])
  })
})

describe('errors', () => {
  it('rejects a duplicate name', () => {
    const error = thrownBy(() => resolveExtensions([ext('a'), ext('b'), ext('a')]))

    expect(error).toBeInstanceOf(ExtensionError)
    expect(error).toMatchObject({ reason: 'duplicate', names: ['a'] })
  })

  it('rejects a missing requirement, naming who and what', () => {
    const error = thrownBy(() => resolveExtensions([ext('b', ['x']), ext('a')]))

    expect(error).toBeInstanceOf(ExtensionError)
    expect(error).toMatchObject({ reason: 'missing', names: ['b', 'x'] })
  })

  it('rejects a cycle, naming the loop from its smallest name', () => {
    const error = thrownBy(() => resolveExtensions([ext('a', ['c']), ext('c', ['b']), ext('b', ['a'])]))

    expect(error).toBeInstanceOf(ExtensionError)
    expect(error).toMatchObject({ reason: 'cycle', names: ['a', 'c', 'b'] })
    for (const name of ['a', 'b', 'c']) expect((error as ExtensionError).message).toContain(name)
  })

  it('names only the loop when other extensions merely wait on it', () => {
    // `0-waiting` is smaller than every name in the loop but is not part of it.
    const error = thrownBy(() =>
      resolveExtensions([ext('0-waiting', ['b']), ext('a', ['b']), ext('b', ['a'])]),
    )

    expect(error).toMatchObject({ reason: 'cycle', names: ['a', 'b'] })
  })

  it('throws an untyped manifest field from manifest(config)', () => {
    const untyped = defineExtension({
      name: 'sneaky',
      manifest: (() => ({ wants: [] })) as unknown as NonNullable<ExtensionDef['manifest']>,
    })
    const resolved = resolveExtensions([untyped])

    const error = thrownBy(() => resolved.manifest(config))

    expect(error).toBeInstanceOf(ExtensionError)
    expect(error).toMatchObject({ reason: 'manifest-field', names: ['sneaky', 'wants'] })
  })

  it('throws an untyped field inside loading too', () => {
    const untyped = defineExtension({
      name: 'sneaky',
      manifest: (() => ({ loading: { lazy: [] } })) as unknown as NonNullable<ExtensionDef['manifest']>,
    })

    const error = thrownBy(() => resolveExtensions([untyped]).manifest(config))

    expect(error).toMatchObject({ reason: 'manifest-field', names: ['sneaky', 'lazy'] })
  })
})

describe('contributions', () => {
  it('concatenates simPlugins and contentSchemas in extension order', () => {
    const plugin = (name: string): PluginDef => ({ name }) as unknown as PluginDef
    const schema = (kind: string): ContentSchemaDef => ({ kind }) as unknown as ContentSchemaDef
    const resolved = resolveExtensions([
      defineExtension({
        name: 'b',
        requires: ['a'],
        sim: [plugin('b1'), plugin('b2')],
        content: [schema('kb')],
      }),
      defineExtension({ name: 'a', sim: [plugin('a1')], content: [schema('ka')] }),
    ])

    expect(resolved.simPlugins).toEqual([plugin('a1'), plugin('b1'), plugin('b2')])
    expect(resolved.contentSchemas).toEqual([schema('ka'), schema('kb')])
  })

  it('returns each extension component for a slot in order, and none for an unused slot', () => {
    const component = (id: string): UiComponent => (() => id) as unknown as UiComponent
    const first = component('first')
    const second = component('second')
    const resolved = resolveExtensions([
      defineExtension({ name: 'b', requires: ['a'], ui: { slots: { 'title.actions': second } } }),
      defineExtension({ name: 'a', ui: { slots: { 'title.actions': first } } }),
    ])

    expect(resolved.slots('title.actions')).toEqual([first, second])
    expect(resolved.slots('debug.panels')).toEqual([])
    expectTypeOf(resolved.slots('debug.panels')).toEqualTypeOf<readonly UiComponent[]>()
  })

  it('merges preload lists, keeping the first place of a repeated path', () => {
    const preload =
      (...paths: string[]): NonNullable<ExtensionDef['manifest']> =>
      () => ({ loading: { preload: paths } })
    const resolved = resolveExtensions([
      defineExtension({ name: 'a', manifest: preload('x', 'y') }),
      defineExtension({ name: 'b', requires: ['a'], manifest: preload('y', 'z') }),
    ])

    expect(resolved.manifest(config)).toEqual({ loading: { preload: ['x', 'y', 'z'] } })
  })

  it('passes the config to each manifest function', () => {
    const seen: GameConfig[] = []
    const resolved = resolveExtensions([
      defineExtension({
        name: 'a',
        manifest: (given) => {
          seen.push(given)
          return {}
        },
      }),
    ])

    resolved.manifest(config)

    expect(seen).toEqual([config])
    expect(seen[0]).toBe(config)
  })

  it('returns an empty contribution when no extension contributes', () => {
    expect(resolveExtensions([ext('a'), ext('b')]).manifest(config)).toEqual({})
    expect(resolveExtensions([]).manifest(config)).toEqual({})
  })
})

describe('layers', () => {
  interface Probe {
    readonly label: string
  }
  const Probe = Context.GenericTag<Probe>('test/Probe')
  interface Derived {
    readonly label: string
  }
  const Derived = Context.GenericTag<Derived>('test/Derived')

  it('builds an empty layer when there are no extensions', async () => {
    const context = await runScoped(Layer.build(resolveExtensions([]).layer))

    expect(Context.isContext(context)).toBe(true)
  })

  it('lets a later extension use a service an earlier one provides', async () => {
    const a = defineExtension({ name: 'a', layers: Layer.succeed(Probe, { label: 'from-a' }) })
    const b = defineExtension({
      name: 'b',
      requires: ['a'],
      layers: Layer.effect(
        Derived,
        Effect.map(Probe, (probe) => ({ label: `b saw ${probe.label}` })),
      ),
    })
    // The array order is reversed on purpose: resolution, not the caller, decides the order.
    const resolved = resolveExtensions([b, a])

    const context = await runScoped(Layer.build(resolved.layer))

    expect(Context.get(context, Probe).label).toBe('from-a')
    expect(Context.get(context, Derived).label).toBe('b saw from-a')
  })

  it('provides runtime services to extension layers', async () => {
    const needsHosting = defineExtension({
      name: 'needs-hosting',
      layers: Layer.effect(
        Probe,
        Effect.map(Hosting, (hosting) => ({ label: `hosting ${typeof hosting.saves}` })),
      ),
    })
    const resolved = resolveExtensions([needsHosting])

    const context = await runScoped(Layer.build(resolved.layer.pipe(Layer.provide(HostingTest()))))

    expect(Context.get(context, Probe).label).toBe('hosting object')
  })
})
