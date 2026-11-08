import '#src/shared/ui/theme.css'
import { afterEach, expect, test } from 'vitest'
import Toggle from '#src/shared/ui/controls/Toggle.svelte'
import { type MountedFixture, mountFixture } from '#src/testing/fixtures/mount.ts'
import { settleLayout } from '#src/testing/ui/settle.ts'

// What a Toggle asks of the box it sits in, with production CSS in a real browser. A game may put one in a track
// sized by what it holds (a grid's `auto` column, a `min-content` box): there its name may wrap between words, but
// no word of it breaks. Only a toggle given less room than that (a long language in a narrow list) breaks a word,
// which the Settings contract checks.

let mounted: MountedFixture | undefined
afterEach(async () => {
  const host = mounted?.target
  await mounted?.unmount()
  host?.remove()
  mounted = undefined
})

test('keeps every word of its name whole in a box sized to its least width', async () => {
  const host = document.body.appendChild(document.createElement('div'))
  host.style.width = 'min-content'
  const none = (): void => undefined
  const props = { label: 'Reduce motion', checked: false, onLabel: 'On', offLabel: 'Off', onchange: none }
  mounted = mountFixture(Toggle, props, host)
  await settleLayout()
  const name = host.querySelector<HTMLElement>('.af-toggle__label')
  if (name === null) throw new Error('no toggle name')
  // Each word as wide as it is drawn unbroken, in the name's own font.
  const widest = Math.max(
    ...['Reduce', 'motion'].map((word) => {
      const probe = name.appendChild(document.createElement('span'))
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap'
      probe.textContent = word
      const width = probe.getBoundingClientRect().width
      probe.remove()
      return width
    }),
  )
  expect(name.getBoundingClientRect().width).toBeGreaterThanOrEqual(widest - 0.5)
})
