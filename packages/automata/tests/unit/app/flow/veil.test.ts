import { describe, expect, it } from 'vitest'
import { createVeil, FADE_MS, REDUCED_FADE_MS } from '#src/app/flow/veil.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'

/** Whether `promise` has settled, after the microtasks queued so far have run. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false
  void promise.then(() => {
    done = true
  })
  await Promise.resolve()
  await Promise.resolve()
  return done
}

function overlayInPage(): HTMLElement {
  const overlay = document.createElement('div')
  document.body.appendChild(overlay)
  return overlay
}

describe('fade veil', () => {
  it('cover() takes 350 ms (not done at 349) and its element takes the pointer while covering', async () => {
    const overlay = overlayInPage()
    const clock = fakeClock()
    const veil = createVeil({ overlay, reducedMotion: () => false, clock })

    expect(overlay.contains(veil.element)).toBe(true)
    expect(veil.element.style.pointerEvents).toBe('none')

    const covering = veil.cover()
    expect(veil.element.style.pointerEvents).toBe('auto')

    clock.advance(349)
    expect(await settled(covering)).toBe(false)

    clock.advance(1)
    expect(await covering).toBe(true)
    expect(veil.element.style.pointerEvents).toBe('auto')

    veil.dispose()
    expect(overlay.contains(veil.element)).toBe(false)
    overlay.remove()
  })

  it('reveal() takes 350 ms and releases the pointer', async () => {
    const overlay = overlayInPage()
    const clock = fakeClock()
    const veil = createVeil({ overlay, reducedMotion: () => false, clock })

    const covering = veil.cover()
    clock.advance(FADE_MS)
    await covering
    expect(veil.element.style.pointerEvents).toBe('auto')

    const revealing = veil.reveal()
    clock.advance(349)
    expect(await settled(revealing)).toBe(false)
    expect(veil.element.style.pointerEvents).toBe('auto')

    clock.advance(1)
    await revealing
    expect(veil.element.style.pointerEvents).toBe('none')

    veil.dispose()
    overlay.remove()
  })

  it('under reduced motion each half takes 100 ms', async () => {
    const overlay = overlayInPage()
    const clock = fakeClock()
    const veil = createVeil({ overlay, reducedMotion: () => true, clock })

    const covering = veil.cover()
    clock.advance(REDUCED_FADE_MS - 1)
    expect(await settled(covering)).toBe(false)
    clock.advance(1)
    expect(await covering).toBe(true)

    const revealing = veil.reveal()
    clock.advance(REDUCED_FADE_MS - 1)
    expect(await settled(revealing)).toBe(false)
    clock.advance(1)
    await revealing
    expect(veil.element.style.pointerEvents).toBe('none')

    veil.dispose()
    overlay.remove()
  })

  it('when the overlay throws on insert, cover() returns false (edge becomes a cut)', async () => {
    const throwingOverlay = {
      firstChild: null,
      insertBefore: () => {
        throw new Error('Insert failed!')
      },
      removeChild: () => {},
      contains: () => false,
    } as unknown as HTMLElement

    const veil = createVeil({ overlay: throwingOverlay, reducedMotion: () => false, clock: fakeClock() })
    expect(await veil.cover()).toBe(false)
    veil.dispose()
  })

  it('dispose() removes the element', () => {
    const overlay = overlayInPage()
    const veil = createVeil({ overlay, reducedMotion: () => false, clock: fakeClock() })
    expect(overlay.contains(veil.element)).toBe(true)

    veil.dispose()
    expect(overlay.contains(veil.element)).toBe(false)
    overlay.remove()
  })
})
