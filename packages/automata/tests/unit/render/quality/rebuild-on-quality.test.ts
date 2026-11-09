import { describe, expect, it } from 'vitest'
import { rebuildOnQuality } from '#src/features/render/quality/rebuild-on-quality.ts'
import type { QualityTier } from '#src/shared/runtime/display-settings.schema.ts'
import type { SettingsStore } from '#src/shared/runtime/settings/settings.manager.ts'

// Over runtime's SettingsStore.
interface TestSettings {
  readonly display: { readonly quality: QualityTier }
  readonly audio: { readonly muted: boolean }
}

function store(initial: TestSettings): SettingsStore<TestSettings> {
  let value = initial
  const listeners = new Set<(value: TestSettings) => void>()
  return {
    get: () => value,
    subscribe(listener) {
      listeners.add(listener)
      listener(value)
      return () => void listeners.delete(listener)
    },
    update(change) {
      value = change(value)
      for (const listener of [...listeners]) listener(value)
    },
  }
}

const quality = (settings: TestSettings) => settings.display.quality

describe('rebuilding on a quality change', () => {
  it('destroys the old build before the new one exists, and leaves nothing behind', () => {
    const settings = store({ display: { quality: 'high' }, audio: { muted: false } })
    const live = new Set<string>()
    let serial = 0
    const build = (tier: QualityTier) => {
      serial += 1
      const id = `${tier}#${serial}`
      expect(live.size).toBe(0)
      live.add(id)
      return { id, destroy: () => live.delete(id) }
    }

    const mounted = rebuildOnQuality(settings, quality, build)
    expect([...live]).toEqual(['high#1'])

    settings.update((value) => ({ ...value, display: { quality: 'low' } }))
    settings.update((value) => ({ ...value, display: { quality: 'high' } }))
    expect([...live]).toEqual(['high#3'])
    expect(mounted.current().id).toBe('high#3')

    mounted.dispose()
    expect(live.size).toBe(0)
  })

  it('ignores changes that are not the quality', () => {
    const settings = store({ display: { quality: 'high' }, audio: { muted: false } })
    let builds = 0
    rebuildOnQuality(settings, quality, () => {
      builds += 1
      return { destroy() {} }
    })
    settings.update((value) => ({ ...value, audio: { muted: true } }))
    expect(builds).toBe(1)
  })

  it('tells onBuilt about each build', () => {
    const settings = store({ display: { quality: 'medium' }, audio: { muted: false } })
    const seen: QualityTier[] = []
    rebuildOnQuality(
      settings,
      quality,
      (tier) => ({ tier, destroy() {} }),
      (built) => seen.push(built.tier),
    )
    settings.update((value) => ({ ...value, display: { quality: 'low' } }))
    expect(seen).toEqual(['medium', 'low'])
  })
})
