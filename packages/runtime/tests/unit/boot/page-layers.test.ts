import type { BootFailure } from '@mcthaydt/automata-ui'
import { flushSync } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPageLayers } from '#src/boot/page-layers.svelte.ts'

describe('createPageLayers', () => {
  let root: HTMLElement

  beforeEach(() => {
    document.documentElement.removeAttribute('data-state')
    root = document.createElement('div')
    document.body.appendChild(root)
    return () => {
      root.remove()
      document.documentElement.removeAttribute('data-state')
    }
  })

  it('appends three children in order with data-layer stage, screens, overlay', () => {
    const layers = createPageLayers(root, document)

    expect(root.children.length).toBe(3)
    expect(root.children[0]?.getAttribute('data-layer')).toBe('stage')
    expect(root.children[1]?.getAttribute('data-layer')).toBe('screens')
    expect(root.children[2]?.getAttribute('data-layer')).toBe('overlay')

    expect(layers.stage).toBe(root.children[0])
    expect(layers.screens).toBe(root.children[1])
    expect(layers.overlay).toBe(root.children[2])
    expect(layers.root).toBe(root)

    layers.dispose()
  })

  it('showLoader mounts LoaderOverlay; setProgress updates progress; setSlow updates slow; close unmounts it', () => {
    const layers = createPageLayers(root, document)
    const loader = layers.showLoader({ label: 'Loading files…', slowLabel: 'Still working…' })
    flushSync()

    const overlayEl = root.querySelector('[data-layer="overlay"]')!
    const loaderEl = overlayEl.querySelector('[data-testid="loader-overlay"]')
    expect(loaderEl).not.toBeNull()
    expect(loaderEl?.textContent).toContain('Loading files…')

    // indeterminate by default
    const bar = loaderEl?.querySelector('[role="progressbar"]')
    expect(bar?.getAttribute('data-indeterminate')).toBe('')

    // setProgress(0.5) -> shows 50%
    flushSync(() => {
      loader.setProgress(0.5)
    })
    expect(bar?.getAttribute('aria-valuenow')).toBe('50')
    expect(bar?.hasAttribute('data-indeterminate')).toBe(false)

    // setProgress(undefined) -> indeterminate again
    flushSync(() => {
      loader.setProgress(undefined)
    })
    expect(bar?.getAttribute('data-indeterminate')).toBe('')

    // setSlow(true) -> shows slow line
    const slowEl = loaderEl?.querySelector('[data-testid="loader-slow"]')
    expect(slowEl?.textContent).toBe('')
    flushSync(() => {
      loader.setSlow(true)
    })
    expect(slowEl?.textContent).toBe('Still working…')

    // close() -> unmounts
    loader.close()
    flushSync()
    expect(overlayEl.querySelector('[data-testid="loader-overlay"]')).toBeNull()

    layers.dispose()
  })

  it('showBootFailure draws alert with copy, and buttons call handlers; returns unmount function', () => {
    const layers = createPageLayers(root, document)
    const onRetry = vi.fn()
    const onExit = vi.fn()
    const failure: BootFailure = {
      _tag: 'AssetLoadFailed',
      url: '/a.png',
      status: 404,
    }

    const unmountBoot = layers.showBootFailure({
      failure,
      hostKind: 'ruken',
      hostName: 'Ruken',
      canExit: true,
      onRetry,
      onExit,
    })
    flushSync()

    const overlayEl = root.querySelector('[data-layer="overlay"]')!
    const alert = overlayEl.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toContain("Couldn't download the game")

    // Buttons
    const buttons = alert?.querySelectorAll('button')
    expect(buttons?.length).toBeGreaterThan(0)
    const retryBtn = Array.from(buttons ?? []).find((b) => b.textContent?.includes('Try again'))
    expect(retryBtn).toBeDefined()
    retryBtn?.click()
    expect(onRetry).toHaveBeenCalledOnce()

    // Unmount
    unmountBoot()
    flushSync()
    expect(overlayEl.querySelector('[role="alert"]')).toBeNull()

    layers.dispose()
  })

  it('showError draws ErrorPanel with code, message, actions; returns unmount function', () => {
    const layers = createPageLayers(root, document)
    const onAction = vi.fn()

    const unmountError = layers.showError({
      code: 'sim-faulted',
      message: 'Simulation encountered a fault',
      actions: [{ id: 'retry', label: 'Try again', kind: 'primary', onSelect: onAction }],
    })
    flushSync()

    const overlayEl = root.querySelector('[data-layer="overlay"]')!
    const alert = overlayEl.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.textContent).toContain('Simulation encountered a fault')

    const btn = overlayEl.querySelector('button')
    btn?.click()
    expect(onAction).toHaveBeenCalledOnce()

    unmountError()
    flushSync()
    expect(overlayEl.querySelector('[role="alert"]')).toBeNull()

    layers.dispose()
  })

  it('setState writes data-state on document.documentElement', () => {
    const layers = createPageLayers(root, document)

    layers.setState('loading')
    expect(document.documentElement.getAttribute('data-state')).toBe('loading')

    layers.setState('ready')
    expect(document.documentElement.getAttribute('data-state')).toBe('ready')

    layers.setState('failed')
    expect(document.documentElement.getAttribute('data-state')).toBe('failed')

    layers.dispose()
  })

  it('dispose unmounts everything and empties root; a second dispose is a no-op', () => {
    const layers = createPageLayers(root, document)
    layers.showLoader({ label: 'Loading…', slowLabel: 'Slow…' })
    flushSync()

    expect(root.children.length).toBe(3)
    const overlayEl = root.querySelector('[data-layer="overlay"]')!
    expect(overlayEl.children.length).toBeGreaterThan(0)

    layers.dispose()
    flushSync()

    expect(root.children.length).toBe(0)

    // Second dispose does not throw or error
    expect(() => layers.dispose()).not.toThrow()
  })
})
