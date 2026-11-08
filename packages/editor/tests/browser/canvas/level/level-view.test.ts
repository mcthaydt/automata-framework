import '#src/shared/kit/tokens.css'
import '#src/shared/kit/fonts.css'
import '#src/app/editor-2d/main.css'
import { cleanup, render } from '@testing-library/svelte'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { createEditorApp } from '#src/app/editor-2d/editor-app.ts'
import { componentOf } from '#src/app/editor-2d/views.ts'
import DocumentScreen from '#src/features/document/DocumentScreen.svelte'
import { createDocumentController } from '#src/features/document/document-controller.ts'
import type { LifecycleDocument, LifecycleWindow } from '#src/shared/kit/storage/page-lifecycle.ts'
import { createToasts } from '#src/shared/kit/widgets/toasts.ts'
import { counterIds } from '#src/shared/level-2d/model/ids.ts'
import type { Project } from '#src/shared/level-2d/model/project-types.ts'
import { createAppProfiles } from '#src/shared/level-2d/profiles/app-profiles.ts'
import type { OpenDocument } from '#src/shared/level-2d/session/editor-app-types.ts'
import { stubGeometry } from '#src/testing/kit/stub-geometry.svelte.ts'
import { createTestClock } from '#src/testing/kit/test-clock.ts'
import { memoryWorkspace } from '#src/testing/level-2d/memory-workspace.ts'

// The Level view with the real Pixi canvas and real pointer events, in Chromium and in WebKit, the iPad's engine, at the iPad 11" landscape size: the canvas draws, a pen
// stroke paints cells as one undo step, a touch stroke the system cancels leaves nothing, and a two-finger tap undoes.
// Points are found from the drawn level's own box, so the test does not depend on the fitted zoom.

const quietPage = (): { document: LifecycleDocument; window: LifecycleWindow } => ({
  document: { visibilityState: 'visible', addEventListener: () => {}, removeEventListener: () => {} },
  window: { addEventListener: () => {}, removeEventListener: () => {} },
})

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

async function mount() {
  await page.viewport(1194, 834)
  const clock = createTestClock()
  const workspace = memoryWorkspace(clock)
  const app = createEditorApp({ workspace, registry: createAppProfiles(), ids: counterIds(), clock })
  const opened = await app.create('level-project', 'platformer')
  if (opened.status !== 'opened') throw new Error(opened.status)
  const toasts = createToasts({ clock })
  const controller = createDocumentController({ app, opened, toasts, lifecycle: quietPage() })
  const box = document.body.appendChild(document.createElement('div'))
  box.style.cssText = 'position: fixed; inset: 0'
  render(DocumentScreen, {
    target: box,
    props: {
      geometry: stubGeometry(1194, 834),
      controller,
      viewOf: componentOf,
      toasts,
      clock,
      read: (path: string) => workspace.store.read(path),
      ids: counterIds(100),
      onback: () => {},
    },
  })
  const surface = document.querySelector<HTMLElement>('[data-testid="level-surface"]')
  const host = document.querySelector<HTMLElement>('[data-level-canvas]')
  if (surface === null || host === null) throw new Error('no level canvas')
  await expect.poll(() => host.dataset['state'], { timeout: 10_000 }).toBe('drawn')
  chooseLayer('Collision')
  return { document: opened.document, surface }
}

function chooseLayer(name: string): void {
  const row = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.querySelector('.label')?.textContent === name,
  )
  const button = row?.querySelector<HTMLElement>('button')
  if (button === null || button === undefined) throw new Error(`no layer ${name}`)
  button.click()
}

const project = (document: OpenDocument): Project => document.history.state as Project

/**
 * The screen point at the centre of a cell of the 512 × 288 level (16 px cells), from where the fitted level sits: the
 * session fits it centred with 24 px of padding, so its box is known from the surface's.
 */
function cellPoint(surface: HTMLElement, cx: number, cy: number): { x: number; y: number } {
  const box = surface.getBoundingClientRect()
  const scale = Math.min((box.width - 48) / 512, (box.height - 48) / 288)
  const left = box.left + (box.width - 512 * scale) / 2
  const top = box.top + (box.height - 288 * scale) / 2
  return { x: left + (cx * 16 + 8) * scale, y: top + (cy * 16 + 8) * scale }
}

function pointer(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  at: { x: number; y: number },
  kind: 'pen' | 'touch',
  id = 1,
): void {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: id,
      pointerType: kind,
      isPrimary: id === 1,
      clientX: at.x,
      clientY: at.y,
      button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : 0.5,
    }),
  )
}

const collision = (document: OpenDocument, cx: number, cy: number): number => {
  const layer = project(document).levels[0]?.layers.find((each) => each.def === 'collision')
  return layer?.kind === 'intgrid' ? layer.cells.get(cx, cy) : -1
}

describe('Level view with the real canvas', () => {
  it('a pen stroke paints the cells it crosses, as one undo step', async () => {
    const { document: opened, surface } = await mount()
    const before = opened.history.revision
    pointer(surface, 'pointerdown', cellPoint(surface, 3, 5), 'pen')
    for (const cx of [4, 5, 6, 7]) pointer(surface, 'pointermove', cellPoint(surface, cx, 5), 'pen')
    pointer(surface, 'pointerup', cellPoint(surface, 7, 5), 'pen')
    expect([3, 4, 5, 6, 7].map((cx) => collision(opened, cx, 5))).toEqual([1, 1, 1, 1, 1])
    expect(opened.history.revision).toBe(before + 1)
    expect(opened.history.undoLabel).toBe('Paint')
  })

  it('a touch stroke the system cancels leaves the level as it was', async () => {
    const { document: opened, surface } = await mount()
    const start = project(opened)
    pointer(surface, 'pointerdown', cellPoint(surface, 3, 8), 'touch')
    for (const cx of [4, 5, 6]) pointer(surface, 'pointermove', cellPoint(surface, cx, 8), 'touch')
    pointer(surface, 'pointercancel', cellPoint(surface, 6, 8), 'touch')
    expect(project(opened)).toBe(start)
    expect(opened.history.canUndo).toBe(false)
  })

  it('a two-finger tap undoes the last stroke', async () => {
    const { document: opened, surface } = await mount()
    const start = project(opened)
    // A finger draws while no pen has been used (with a pen, a finger only navigates, and lands as a palm near it).
    pointer(surface, 'pointerdown', cellPoint(surface, 2, 3), 'touch')
    pointer(surface, 'pointermove', cellPoint(surface, 4, 3), 'touch')
    pointer(surface, 'pointerup', cellPoint(surface, 4, 3), 'touch')
    expect(collision(opened, 3, 3)).toBe(1)
    const [a, b] = [cellPoint(surface, 10, 10), cellPoint(surface, 14, 10)]
    pointer(surface, 'pointerdown', a, 'touch', 2)
    pointer(surface, 'pointerdown', b, 'touch', 3)
    pointer(surface, 'pointerup', a, 'touch', 2)
    pointer(surface, 'pointerup', b, 'touch', 3)
    expect(project(opened)).toBe(start)
  })
})
