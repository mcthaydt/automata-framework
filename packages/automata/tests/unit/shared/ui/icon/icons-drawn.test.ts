import { createRawSnippet, flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import Modal from '#src/shared/ui/dialog/Modal.svelte'
import RotateHint from '#src/shared/ui/display/RotateHint.svelte'
import RotateToast from '#src/shared/ui/display/RotateToast.svelte'
import Icon, { type IconName } from '#src/shared/ui/icon/Icon.svelte'
import OptionGroup from '#src/shared/ui/layout/OptionGroup.svelte'
import Prompt from '#src/shared/ui/prompts/Prompt.svelte'
import { PLAYSTATION_CROSS } from '#src/shared/ui/prompts/prompt-label.ts'
import SaveStatus from '#src/shared/ui/status/SaveStatus.svelte'

// The pixel font every game ships has no check mark, cross or turning arrow, and no language falls back to the
// device's fonts, so core draws all three as inline SVG. A symbol typed as text would show as a blank box.

const TYPED = /[✓✕⟳]/

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function show(which: unknown, props: Record<string, unknown>): HTMLElement {
  const target = document.createElement('div')
  document.body.append(target)
  component = mount(which as never, { target, props } as never)
  flushSync()
  return target
}

const noText = (root: HTMLElement) => expect(root.textContent ?? '').not.toMatch(TYPED)

describe('Icon', () => {
  it.each(['check', 'cross', 'rotate'] as const satisfies readonly IconName[])(
    '%s is an inline SVG, hidden from assistive technology, drawn in the text colour',
    (name) => {
      const svg = show(Icon, { name }).querySelector('svg')
      expect(svg?.getAttribute('data-icon')).toBe(name)
      expect(svg?.getAttribute('aria-hidden')).toBe('true')
      expect(svg?.getAttribute('stroke')).toBe('currentColor')
      expect(svg?.querySelector('path')).not.toBeNull()
    },
  )
})

describe('the symbols core draws', () => {
  it('the Modal’s close button holds a cross icon and no text glyph', () => {
    const body = createRawSnippet(() => ({ render: () => '<p>Body</p>' }))
    const root = show(Modal, { title: 'T', closeLabel: 'Close', onclose: () => {}, children: body })
    expect(root.querySelector('[data-modal-close] [data-icon="cross"]')).not.toBeNull()
    noText(root)
  })

  it('the rotate hint and the rotate toast hold a rotate icon', () => {
    const hint = show(RotateHint, { shown: true, copy: { title: 'Turn', body: 'Turn it' } })
    expect(hint.querySelector('[data-icon="rotate"]')).not.toBeNull()
    noText(hint)
    unmount(component as ReturnType<typeof mount>)
    const toast = show(RotateToast, {
      shown: true,
      copy: { text: 'Turn', ok: 'OK', dismiss: 'Dismiss' },
      ondismiss: () => {},
    })
    expect(toast.querySelector('[data-icon="rotate"]')).not.toBeNull()
    noText(toast)
  })

  it('the chosen option’s mark is a check icon', () => {
    const root = show(OptionGroup, {
      label: 'Quality',
      options: [{ value: 'a', label: 'A' }],
      value: 'a',
      onchange: () => {},
    })
    expect(root.querySelector('[data-option-mark] [data-icon="check"]')).not.toBeNull()
    noText(root)
  })

  it('a saved status shows a check icon, and a warning keeps its text mark', () => {
    const copy = {
      checking: '',
      syncing: '',
      saved: 'Saved',
      'offline-queued': '',
      retry: 'Retry',
      conflict: '',
      recovered: '',
      'no-grant': '',
    }
    const saved = show(SaveStatus, { status: 'saved', copy })
    expect(saved.querySelector('[data-save-status-glyph] [data-icon="check"]')).not.toBeNull()
    noText(saved)
    unmount(component as ReturnType<typeof mount>)
    const retry = show(SaveStatus, { status: 'retry', copy })
    expect(retry.querySelector('[data-save-status-glyph]')?.textContent).toBe('!')
  })

  it('the PlayStation cross prompt is drawn, and still says its name to assistive technology', () => {
    const root = show(Prompt, {
      binding: { keys: [], pad: [0], touch: false },
      device: 'gamepad',
      glyphs: 'playstation',
      copy: { unbound: 'Unbound', touch: 'Tap', pad: {} },
    })
    expect(root.querySelector('[data-icon="cross"]')).not.toBeNull()
    expect(root.querySelector('.af-sr-only')?.textContent).toBe(PLAYSTATION_CROSS)
  })
})
