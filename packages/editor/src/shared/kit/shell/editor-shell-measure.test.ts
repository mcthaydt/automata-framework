import { render } from '@testing-library/svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ShellFixture from '../../../testing/kit/ShellFixture.svelte'
import { stubGeometry } from '../../../testing/kit/stub-geometry.svelte'

// The shell measures its rail and status line to lift the toasts above them. A screen may take its rail away while it
// is shown (the 3D editor has none below wide): the shell must then stop measuring it, not hand the observer the empty
// binding, which a browser refuses ("ResizeObserver.observe: Argument 1 must be an Element").

afterEach(() => vi.unstubAllGlobals())

describe('the shell measuring its foot', () => {
  it('keeps going when the rail is taken away while shown', async () => {
    const observed: unknown[] = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe(target: unknown): void {
          if (!(target instanceof Element))
            throw new TypeError('ResizeObserver.observe: Argument 1 must be an Element')
          observed.push(target)
        }
        disconnect(): void {}
      },
    )
    const geometry = stubGeometry(1194, 834)
    const { rerender } = render(ShellFixture, { geometry, rail: true, statusLine: true })
    expect(observed.length).toBeGreaterThan(0)
    await expect(rerender({ geometry, rail: false, statusLine: true })).resolves.not.toThrow()
  })
})
