import { describe, expect, it } from 'vitest'
import {
  CHANGED_ELSEWHERE_COPY,
  CHANGED_ELSEWHERE_TOAST,
  SAVE_SLOTS_COPY,
  SAVE_STATUS_COPY,
} from '#src/app/screens/saves/saves-copy.ts'
import { PAD_UNSUPPORTED } from '#src/app/screens/screen-kit.ts'
import { screensCopy } from '#src/app/screens/screens-copy.svelte.ts'
import { BOARD_COPY, DEFAULT_SCREENS_COPY, resolveScreensCopy } from '#src/app/screens/screens-copy.ts'
import {
  AUDIO_COPY,
  CONTROLS_COPY,
  DISPLAY_COPY,
  LANGUAGE_COPY,
  PROMPT_COPY,
  SETTINGS_COPY,
  TOUCH_COPY,
  VIBRATION_COPY,
} from '#src/app/screens/settings/settings-copy.ts'
import { disposables } from '#src/shared/lib/disposables.ts'

// DX.2d: the default screens' words are one record with English defaults that a game's `copy.screens` overrides,
// re-read in the player's language each time it changes (PRODUCT spec §4 items 1 and 2, L-c).

describe('DEFAULT_SCREENS_COPY', () => {
  // A game-maker's words ("title" screen, a "run", a "slot") mean nothing to a player; the leave question says what
  // happens, and its button does not repeat the one she just pressed.
  it('the leave question and the save failure use plain words', () => {
    const { paused } = DEFAULT_SCREENS_COPY
    const words = [paused.quit, paused.quitPrompt, paused.quitConfirm, paused.cancel, SAVE_SLOTS_COPY.failed]
    for (const text of words) expect(text, text).not.toMatch(/\b(title|run|slot)\b/i)
    expect(paused.quitConfirm).not.toBe(paused.quit)
  })

  it('holds the words the screens showed before, unchanged', () => {
    expect(DEFAULT_SCREENS_COPY.title).toEqual({ play: 'Play' })
    expect(DEFAULT_SCREENS_COPY.play).toEqual({ pause: 'Pause', move: 'Move' })
    expect(DEFAULT_SCREENS_COPY.paused).toEqual({
      title: 'Paused',
      resume: 'Resume',
      close: 'Close',
      back: 'Back',
      mute: 'Mute',
      unmute: 'Unmute',
      settings: 'Settings',
      quit: 'Back to menu',
      quitPrompt: 'Leave this game? Unsaved progress is lost.',
      quitConfirm: 'Leave',
      cancel: 'Keep playing',
      reconnect: 'Reconnect your controller',
    })
    expect(DEFAULT_SCREENS_COPY.settings).toEqual({
      screen: SETTINGS_COPY,
      prompts: PROMPT_COPY,
      controls: CONTROLS_COPY,
      language: LANGUAGE_COPY,
      vibration: VIBRATION_COPY,
      audio: AUDIO_COPY,
      touch: TOUCH_COPY,
      display: DISPLAY_COPY,
    })
    expect(DEFAULT_SCREENS_COPY.saves).toEqual({
      slots: SAVE_SLOTS_COPY,
      status: SAVE_STATUS_COPY,
      changedElsewhere: CHANGED_ELSEWHERE_COPY,
      changedElsewhereToast: CHANGED_ELSEWHERE_TOAST,
    })
    expect(DEFAULT_SCREENS_COPY.board).toBe(BOARD_COPY)
    expect(DEFAULT_SCREENS_COPY.padUnsupported).toBe(PAD_UNSUPPORTED)
  })

  // The copy table (docs/refactor/copy.md): each Settings line says what is happening and what to do, in plain words.
  it('says the Settings and save lines in plain words', () => {
    expect(PROMPT_COPY.unbound).toBe('Not set')
    expect(CONTROLS_COPY.capturing('Jump', 'Keyboard', 9)).toBe(
      'Press a new keyboard button for Jump. 9 seconds left. Escape cancels.',
    )
    expect(CONTROLS_COPY.conflict('Jump', 'Fire')).toBe('Fire needs that one. Pick another for Jump.')
    expect(AUDIO_COPY.muteUnfocused).toBe('Mute when you switch away')
    expect(AUDIO_COPY.buses.master).toBe('All sound')
    expect(DISPLAY_COPY.reducedMotion(true)).toBe('Reduced motion is on in your device’s settings.')
    expect(DISPLAY_COPY.reducedMotion(false)).toBe('Reduced motion is off in your device’s settings.')
    expect(SAVE_SLOTS_COPY.otherContent).toBe('From another version: it loads, but some things may reset')
  })
})

describe('resolveScreensCopy', () => {
  it('gives the defaults when the game sets nothing', () => {
    expect(resolveScreensCopy(undefined, 'en')).toEqual(DEFAULT_SCREENS_COPY)
  })

  it('lays a partial record over the defaults, leaf by leaf', () => {
    const copy = resolveScreensCopy(
      {
        title: { play: 'Jouer' },
        paused: { resume: 'Reprendre' },
        settings: { audio: { buses: { music: 'Musique' } } },
      },
      'fr',
    )
    expect(copy.title.play).toBe('Jouer')
    expect(copy.paused.resume).toBe('Reprendre')
    expect(copy.paused.title).toBe('Paused')
    expect(copy.settings.audio.buses).toEqual({ ...AUDIO_COPY.buses, music: 'Musique' })
    expect(copy.settings.audio.mute).toBe('Mute')
  })

  it('takes a function leaf as given', () => {
    const copy = resolveScreensCopy({ settings: { screen: { more: (count) => `+${count} de plus` } } }, 'fr')
    expect(copy.settings.screen.more(3)).toBe('+3 de plus')
    expect(copy.settings.controls.saved('Jump')).toBe('Jump saved')
  })

  it('calls a function input with the locale', () => {
    const seen: string[] = []
    const copy = resolveScreensCopy((locale) => {
      seen.push(locale)
      return { title: { play: locale === 'fr' ? 'Jouer' : 'Play!' } }
    }, 'fr')
    expect(seen).toEqual(['fr'])
    expect(copy.title.play).toBe('Jouer')
  })
})

/** The parts of `Locale` the copy reads: the current locale and its changes. */
function fakeLocale(start: string) {
  let current = start
  const listeners = new Set<(locale: string) => void>()
  return {
    get current() {
      return current
    },
    subscribe(listener: (locale: string) => void) {
      listeners.add(listener)
      listener(current)
      return () => listeners.delete(listener)
    },
    change(next: string) {
      current = next
      for (const listener of listeners) listener(next)
    },
    get listening() {
      return listeners.size
    },
  }
}

describe('screensCopy', () => {
  it('reads the copy in the current locale, again on each change, until its owner is disposed', () => {
    const locale = fakeLocale('en')
    const words = { en: 'Play', fr: 'Jouer', de: 'Spielen' } as Record<string, string>
    const owner = disposables()
    const copy = screensCopy(owner, (current) => ({ title: { play: words[current] ?? '' } }), locale)
    expect(copy.current.title.play).toBe('Play')
    locale.change('fr')
    expect(copy.current.title.play).toBe('Jouer')
    expect(locale.listening).toBe(1)
    owner.dispose()
    expect(locale.listening).toBe(0)
    locale.change('de')
    expect(copy.current.title.play).toBe('Jouer')
  })
})
