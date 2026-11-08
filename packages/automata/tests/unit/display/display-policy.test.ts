import { flushSync } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDisplayPolicy } from '#src/features/display/display-policy.svelte.ts'
import { createPresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { createTime } from '#src/shared/runtime/time/time.manager.ts'
import type { FormFactor } from '#src/shared/ui/geometry/form-factor.ts'
import type { Geometry } from '#src/shared/ui/geometry/geometry.ts'
import type { GeometryOwner } from '#src/shared/ui/geometry/geometry-owner.svelte.ts'

// The display policy (M4 spec §4.9, §5, §6, M4-D5): the landscape gate over every screen, standalone only, and the
// rotate hint over a paused game for a game locked to one orientation, on a phone held the other way.

const PIXEL = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'

/** A geometry owner whose form factor the test sets. */
function fakeGeometry(formFactor: FormFactor) {
  const listeners = new Set<(geometry: Geometry) => void>()
  const owner = {
    geometry: { current: { formFactor } as Geometry },
    onChange(listener: (geometry: Geometry) => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    setHostDisplay: () => {},
    remeasure: () => {},
    dispose: () => {},
  }
  const become = (next: FormFactor) => {
    owner.geometry.current = { formFactor: next } as Geometry
    for (const listener of listeners) listener(owner.geometry.current)
  }
  return { owner: owner as unknown as GeometryOwner, become, listeners }
}

/** A window: a coarse or fine pointer, element fullscreen the test can grant or refuse. */
function fakeWindow(options: { coarse?: boolean; grant?: boolean } = {}) {
  const changes = new Set<() => void>()
  const doc = {
    fullscreenEnabled: true,
    fullscreenElement: null as Element | null,
    documentElement: {
      requestFullscreen: vi.fn(async () => {
        if (options.grant === false) throw new Error('refused')
        doc.fullscreenElement = {} as Element
        for (const change of changes) change()
      }),
    },
    addEventListener: (_type: string, listener: () => void) => changes.add(listener),
    removeEventListener: (_type: string, listener: () => void) => changes.delete(listener),
  }
  const media = (matches: boolean) => ({ matches, addEventListener: () => {}, removeEventListener: () => {} })
  const win = {
    document: doc,
    navigator: { userAgent: PIXEL, maxTouchPoints: 5 },
    screen: {},
    matchMedia: (query: string) =>
      media(query.includes('pointer: coarse') ? options.coarse !== false : false),
  }
  return { win: win as unknown as Window, doc, changes }
}

const layer = () => document.body.appendChild(document.createElement('div'))
const gate = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-testid="landscape-gate"]')
const hint = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-testid="rotate-hint"]')
const settle = () => new Promise((resolve) => setTimeout(resolve, 0)).then(() => flushSync())

afterEach(() => {
  document.body.innerHTML = ''
})

/** Runs the policy in its own scope, with a Time to pause. */
const withPolicy = (
  options: {
    orientation?: 'portrait' | 'landscape' | 'any'
    hosted?: boolean
    formFactor?: FormFactor
    coarse?: boolean
    grant?: boolean
    rotateHint?: 'block' | 'toast'
  },
  body: (parts: {
    root: HTMLElement
    time: ReturnType<typeof createTime>
    geometry: ReturnType<typeof fakeGeometry>
    window: ReturnType<typeof fakeWindow>
  }) => Promise<void>,
) =>
  (async () => {
    const time = createTime(createPresentationBus())
    const geometry = fakeGeometry(options.formFactor ?? 'phone-landscape')
    const window = fakeWindow(options)
    const root = layer()
    const policy = createDisplayPolicy({
      orientation: options.orientation ?? 'any',
      hosted: options.hosted ?? false,
      win: window.win,
      geometry: geometry.owner,
      layer: root,
      time,
      ...(options.rotateHint === undefined ? {} : { rotateHint: options.rotateHint }),
    })
    flushSync()
    try {
      await body({ root, time, geometry, window })
    } finally {
      policy.dispose()
    }
  })()

describe('the landscape gate (M4-D5, D-d)', () => {
  it('never shows under a host, whatever the device', () =>
    withPolicy({ hosted: true }, async ({ root }) => {
      expect(gate(root)).toBeNull()
    }))

  it('standalone on a phone held sideways, asks for one tap to go fullscreen', () =>
    withPolicy({}, async ({ root }) => {
      expect(gate(root)?.dataset.gate).toBe('fullscreen')
    }))

  it('opens once the tap has made the page fullscreen', () =>
    withPolicy({}, async ({ root, window }) => {
      root.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-fullscreen"]')?.click()
      await settle()
      expect(window.doc.documentElement.requestFullscreen).toHaveBeenCalledOnce()
      expect(gate(root)).toBeNull()
    }))

  it('stays when the browser refuses fullscreen (§6)', () =>
    withPolicy({ grant: false }, async ({ root }) => {
      root.querySelector<HTMLButtonElement>('[data-testid="landscape-gate-fullscreen"]')?.click()
      await settle()
      expect(gate(root)?.dataset.gate).toBe('fullscreen')
    }))

  it('never shows for a fine pointer (a short desktop window), nor upright', () =>
    withPolicy({ coarse: false }, async ({ root, geometry }) => {
      expect(gate(root)).toBeNull()
      geometry.become('phone-portrait')
      flushSync()
      expect(gate(root)).toBeNull()
    }))
})

describe('the rotate hint', () => {
  it('pauses a portrait game held sideways on a phone, and plays on once turned back', () =>
    withPolicy({ orientation: 'portrait', hosted: true }, async ({ root, time, geometry }) => {
      expect(hint(root)).not.toBeNull()
      expect([...time.reasons]).toEqual(['display'])
      geometry.become('phone-portrait')
      flushSync()
      expect(hint(root)).toBeNull()
      expect(time.paused).toBe(false)
    }))

  it('pauses a landscape game held upright', () =>
    withPolicy(
      { orientation: 'landscape', hosted: true, formFactor: 'phone-portrait' },
      async ({ root, time }) => {
        expect(hint(root)).not.toBeNull()
        expect(time.paused).toBe(true)
      },
    ))

  it('never shows for a game that plays either way, nor off a phone', () =>
    withPolicy({ orientation: 'any', hosted: true }, async ({ root, time, geometry }) => {
      expect(hint(root)).toBeNull()
      expect(time.paused).toBe(false)
      void geometry
    }))

  it('never shows for a fine pointer', () =>
    withPolicy({ orientation: 'portrait', hosted: true, coarse: false }, async ({ root, time }) => {
      expect(hint(root)).toBeNull()
      expect(time.paused).toBe(false)
    }))
})

// Owner amendment, 2026-10-18 (M4 spec §4.9): `rotateHint: 'toast'` gives a dismissible message instead.
describe('the rotate hint as a toast', () => {
  const toast = (root: HTMLElement) => root.querySelector<HTMLElement>('[data-testid="rotate-toast"]')

  it('says to turn the phone, without covering or pausing the game, and goes once dismissed', () =>
    withPolicy(
      { orientation: 'portrait', hosted: true, rotateHint: 'toast' },
      async ({ root, time, geometry }) => {
        expect(hint(root)).toBeNull()
        expect(toast(root)?.textContent).toContain('Turn your phone for a bigger view')
        expect(time.paused).toBe(false)
        toast(root)?.querySelector<HTMLButtonElement>('button')?.click()
        flushSync()
        expect(toast(root)).toBeNull()
        // Dismissed for the session: turning the phone back and forth does not bring it back.
        geometry.become('phone-portrait')
        geometry.become('phone-landscape')
        flushSync()
        expect(toast(root)).toBeNull()
      },
    ))

  it('goes by itself once the phone is turned the right way', () =>
    withPolicy({ orientation: 'portrait', hosted: true, rotateHint: 'toast' }, async ({ root, geometry }) => {
      geometry.become('phone-portrait')
      flushSync()
      expect(toast(root)).toBeNull()
    }))

  it('blocks by default, as before', () =>
    withPolicy({ orientation: 'portrait', hosted: true }, async ({ root, time }) => {
      expect(toast(root)).toBeNull()
      expect(hint(root)).not.toBeNull()
      expect(time.paused).toBe(true)
    }))
})

describe('closing', () => {
  it('unmounts both covers and stops listening when disposed', async () => {
    const bus = createPresentationBus()
    const time = createTime(bus)
    const geometry = fakeGeometry('phone-landscape')
    const window = fakeWindow()
    const root = layer()
    const policy = createDisplayPolicy({
      orientation: 'portrait',
      hosted: false,
      win: window.win,
      geometry: geometry.owner,
      layer: root,
      time,
    })
    flushSync()
    expect(gate(root)).not.toBeNull()
    policy.dispose()
    flushSync()
    expect(root.children.length).toBe(0)
    expect(geometry.listeners.size).toBe(0)
    expect(window.changes.size).toBe(0)
    expect(time.paused).toBe(false)
    bus.dispose()
  })
})
