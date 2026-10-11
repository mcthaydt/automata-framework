import { expect, test, vi } from 'vitest'

// Spec §3.5: importing an entry point loads no Rapier; the wasm loads inside createSim.
test.each([['./3d', '@dimforge/rapier3d-deterministic-compat', 'physics3d']] as const)(
  'importing %s loads no Rapier until createSim',
  async (entry, rapier, factory) => {
    vi.resetModules()
    const loads: string[] = []
    vi.doMock(rapier, async (importOriginal) => {
      loads.push(rapier)
      return importOriginal()
    })
    const mod = (await import(/* @vite-ignore */ entry)) as Record<string, () => unknown>
    expect(loads).toEqual([])
    const { createSim } = await import('@mcthaydt/automata-sim')
    const sim = await createSim({ seed: 1, plugins: [(mod[factory] as () => never)()] })
    expect(loads).toEqual([rapier])
    sim.dispose()
    vi.doUnmock(rapier)
  },
)
