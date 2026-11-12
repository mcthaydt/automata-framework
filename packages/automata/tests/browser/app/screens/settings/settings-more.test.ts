import '#src/shared/ui/theme.css'
import '#src/app/screens/screens.css'
import { describe, expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { screensCopyFor } from '#src/app/screens/screens-copy.ts'
import SettingsView from '#src/app/screens/settings/SettingsView.svelte'
import type { SettingsViewState } from '#src/app/screens/settings/settings-view.ts'
import { DEFAULT_LOCALES } from '#src/entries/runtime.ts'
import { InputMethodTracker } from '#src/shared/ui/browser/input-method.svelte.ts'
import { mountFixture } from '#src/testing/fixtures/mount.ts'
import { REFERENCE_SIZES, VARIANTS } from '#src/testing/layout/reference-sizes.ts'
import { checkLayout, publishConditions } from '#src/testing/ui/layout-contract.ts'
import { settleLayout } from '#src/testing/ui/settle.ts'

// The Settings list holds more groups than a short screen shows, so it says "+N more". That badge is a label for the
// rows out of view and must never sit on the words of one that is in view (audit S8: it covered "Rumble and vibration"
// on a phone and "All sound" on a sideways one). The real screen, in each of the six languages' own words, at a phone
// size, a small phone and the two compact sideways sizes where it overflowed. Where there is no room for the label as
// well as the first group, the label gives way and the group stays whole (the layout contract's sweep holds that).

const SIZES = ['phone-small', 'iphone-14', 'galaxy-chrome-landscape', 'iphone-se-safari-landscape']

const view: SettingsViewState = {
  rows: undefined,
  devices: ['keyboard'],
  coarse: false,
  glyphs: 'generic',
  controls: { kind: 'list' },
  layout: undefined,
  touchModes: [],
  touchMode: 'buttons',
  quality: 'high',
  audio: { muted: false, muteUnfocused: false, gains: { master: 1, music: 0.8, sfx: 1, ui: 0.6, voice: 1 } },
  locales: DEFAULT_LOCALES,
  hapticsSupported: true,
  hapticsEnabled: true,
  localeChoice: null,
  audioAvailable: true,
  hostVolumeBelowFull: false,
  reducedMotion: false,
}

const nothing = (): void => undefined

describe('Settings "+N more" badge', () => {
  for (const locale of DEFAULT_LOCALES) {
    test.each(SIZES)(`never covers a label in ${locale} at %s`, async (name) => {
      const size = REFERENCE_SIZES.find((candidate) => candidate.name === name)
      const [rest] = VARIANTS
      if (size === undefined || rest === undefined) throw new Error(`no ${name} size or rest variant`)
      await page.viewport(size.width, size.height)
      const conditions = publishConditions(document.documentElement, size, rest)
      const tracker = new InputMethodTracker()
      const fixture = mountFixture(SettingsView, {
        view,
        tracker,
        extensions: [],
        onrebind: nothing,
        onreset: nothing,
        ontouchmode: nothing,
        onquality: nothing,
        onaudio: nothing,
        onsample: nothing,
        onlocale: nothing,
        onhaptics: nothing,
        onback: nothing,
        copy: { current: screensCopyFor(locale) },
      })
      await settleLayout()
      const covered = checkLayout(conditions, []).filter((problem) => problem.startsWith('scroll-more'))
      const badge = document.querySelector('[data-testid="scroll-more"]')
      await fixture.unmount()
      // On an upright phone the list overflows by a group and says so; that is the case the audit saw covered. (On a
      // compact sideways screen the first group needs all the room, so the label gives way to it, not the reverse.)
      if (locale === 'en' && name === 'iphone-14')
        expect(badge, 'the label shows on an upright phone').not.toBeNull()
      expect(covered).toEqual([])
    })
  }
})
