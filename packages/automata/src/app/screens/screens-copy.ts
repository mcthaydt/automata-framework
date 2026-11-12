// The default screens' words: one record, English by default, that a game overrides with
// `copy.screens` in its own language. The screens read it through `screensCopy` (screens-copy.svelte.ts), so a
// language change shows the new words without a remount (L-c).

import type { PromptCopy } from '../../shared/ui/prompts/prompt-label.ts'
import type { LeaderboardCopy } from '../../shared/ui/status/leaderboard-panel.ts'
import type { SaveStatusCopy } from '../../shared/ui/status/save-status.ts'
import type { WarningEffect } from '../opening/warning-effects.ts'
import type { SaveSlotsCopy } from './saves/save-slots.ts'
import {
  CHANGED_ELSEWHERE_COPY,
  CHANGED_ELSEWHERE_TOAST,
  type ChangedElsewhereCopy,
  SAVE_SLOTS_COPY,
  SAVE_STATUS_COPY,
} from './saves/saves-copy.ts'
import { PAD_UNSUPPORTED } from './screen-kit.ts'
import { catalogFor, screensCopyFrom } from './screens-catalog.ts'
import type { AudioCopy } from './settings/audio-section.ts'
import type { ControlsCopy } from './settings/controls-section.ts'
import type { DisplayCopy } from './settings/display-section.ts'
import type { LanguageCopy } from './settings/language-section.ts'
import {
  AUDIO_COPY,
  CONTROLS_COPY,
  DISPLAY_COPY,
  LANGUAGE_COPY,
  PROMPT_COPY,
  SETTINGS_COPY,
  TOUCH_COPY,
  VIBRATION_COPY,
} from './settings/settings-copy.ts'
import type { TouchCopy } from './settings/touch-section.ts'
import type { VibrationCopy } from './settings/vibration-section.ts'

/** The Settings screen's own words: its title, Back, the tabs and the overflow count. */
export interface SettingsScreenCopy {
  readonly title: string
  readonly back: string
  readonly tabs: string
  readonly settingsTab: string
  readonly controlsTab: string
  readonly more: (count: number) => string
}

/** The first run's two screens: which language to use, and the warning before anything flashes. */
export interface FirstRunCopy {
  readonly language: { readonly title: string; readonly close: string }
  readonly warning: {
    readonly title: string
    /** What the game may have, for a game that does not say what it has: the sentence and the advice that follows it. */
    readonly body: string
    /**
     * What the game has, for a game that declares its effects: the same sentence and advice, with `effects` (each
     * declared effect from `effects` below, joined as the language joins a list) where the hazards go.
     */
    readonly declared: (effects: string) => string
    /** Each effect a game can declare, as it reads after "This game has": "flashing lights", "a shaking screen". */
    readonly effects: Readonly<Record<WarningEffect, string>>
    /** The heading over the switches that turn the lights and shaking down. */
    readonly choose: string
    /** Where to change the switches later. */
    readonly later: string
    readonly continue: string
    readonly close: string
  }
}

/** Every word the default title, play, paused and settings screens show. */
export interface ScreensCopy {
  readonly title: { readonly play: string }
  /** The play screen's corner button and the touch stick, read by assistive technology. */
  readonly play: { readonly pause: string; readonly move: string }
  readonly paused: {
    readonly title: string
    readonly resume: string
    /** The dialog's ✕ on the menu: not Resume, so a screen reader hears one Resume button, not two. */
    readonly close: string
    /** The dialog's ✕ away from the menu (the quit confirm, the changed-elsewhere step). */
    readonly back: string
    readonly mute: string
    readonly unmute: string
    readonly settings: string
    readonly quit: string
    readonly quitPrompt: string
    readonly quitConfirm: string
    readonly cancel: string
    /** Why play paused when a controller in use was unplugged. */
    readonly reconnect: string
  }
  readonly settings: {
    readonly screen: SettingsScreenCopy
    readonly prompts: PromptCopy
    readonly controls: ControlsCopy
    readonly language: LanguageCopy
    readonly vibration: VibrationCopy
    readonly audio: AudioCopy
    readonly touch: TouchCopy
    readonly display: DisplayCopy
  }
  readonly saves: {
    readonly slots: SaveSlotsCopy
    readonly status: SaveStatusCopy
    readonly changedElsewhere: ChangedElsewhereCopy
    readonly changedElsewhereToast: string
  }
  /** The scored board on the paused screen. */
  readonly board: LeaderboardCopy
  /** Told once when a controller the input does not support is plugged in. */
  readonly padUnsupported: string
  /** The first run's language screen and photosensitivity warning. */
  readonly firstRun: FirstRunCopy
}

// biome-ignore lint/suspicious/noExplicitAny: a copy function's arguments vary; it is replaced whole.
type Leaf = string | ((...args: any[]) => string)

/** A part of `ScreensCopy` with every group optional, down to the words; a word or a function is replaced whole. */
export type ScreensCopyOverrides<T = ScreensCopy> = {
  readonly [K in keyof T]?: T[K] extends Leaf ? T[K] : ScreensCopyOverrides<T[K]>
}

/**
 * A game's words for the default screens: a part of the record, or a function of the player's locale returning one.
 * The function runs again on each language change, so a Paraglide game can pass its messages:
 * `screens: () => ({ title: { play: m.play() } })`.
 */
export type ScreensCopyInput = ScreensCopyOverrides | ((locale: string) => ScreensCopyOverrides)

/** The board's words on the default paused screen. */
export const BOARD_COPY: LeaderboardCopy = {
  title: 'Scores',
  loading: 'Loading scores…',
  empty: 'No scores yet',
  unavailable: "Scores aren't available here",
  offline: "You're offline",
  you: 'You',
  more: (count) => `+${count} more`,
}

/** The default screens' English words. */
export const DEFAULT_SCREENS_COPY: ScreensCopy = {
  title: { play: 'Play' },
  play: { pause: 'Pause', move: 'Move' },
  paused: {
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
  },
  settings: {
    screen: SETTINGS_COPY,
    prompts: PROMPT_COPY,
    controls: CONTROLS_COPY,
    language: LANGUAGE_COPY,
    vibration: VIBRATION_COPY,
    audio: AUDIO_COPY,
    touch: TOUCH_COPY,
    display: DISPLAY_COPY,
  },
  saves: {
    slots: SAVE_SLOTS_COPY,
    status: SAVE_STATUS_COPY,
    changedElsewhere: CHANGED_ELSEWHERE_COPY,
    changedElsewhereToast: CHANGED_ELSEWHERE_TOAST,
  },
  board: BOARD_COPY,
  padUnsupported: PAD_UNSUPPORTED,
  firstRun: {
    language: { title: 'Language', close: 'Close' },
    warning: {
      title: 'Flashing lights warning',
      body: 'This game may have flashing lights or a shaking screen. For a few people these can bring on a seizure, even if they have never had one. If you feel dizzy or unwell, or your eyes or muscles twitch, stop playing and talk to a doctor.',
      declared: (effects) =>
        `This game has ${effects}. For a few people these can bring on a seizure, even if they have never had one. If you feel dizzy or unwell, or your eyes or muscles twitch, stop playing and talk to a doctor.`,
      effects: {
        flashing: 'flashing lights',
        strobing: 'strobing lights',
        shaking: 'a shaking screen',
        patterns: 'high-contrast patterns',
      },
      choose: 'Make it gentler',
      later: 'You can change these later in Settings.',
      continue: 'Continue',
      close: 'Close',
    },
  },
}

const isGroup = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function merge<T>(base: T, over: unknown): T {
  if (!isGroup(over) || !isGroup(base)) return (over === undefined ? base : over) as T
  const out: Record<string, unknown> = { ...base }
  for (const [key, value] of Object.entries(over)) {
    if (value !== undefined) out[key] = merge((base as Record<string, unknown>)[key], value)
  }
  return out as T
}

const translated = new Map<string, ScreensCopy>()

/**
 * The default screens' words in a locale: its bundled catalog (`pt-PT` finds `pt-BR`), or the English record for a
 * language core has no words in.
 */
export function screensCopyFor(locale: string): ScreensCopy {
  const catalog = catalogFor(locale)
  if (catalog === undefined || catalog === catalogFor('en')) return DEFAULT_SCREENS_COPY
  const cached = translated.get(locale)
  if (cached !== undefined) return cached
  const built = screensCopyFrom(catalog, DEFAULT_SCREENS_COPY)
  translated.set(locale, built)
  return built
}

/** The record for `locale`: its bundled words with the game's own laid over them. */
export function resolveScreensCopy(input: ScreensCopyInput | undefined, locale: string): ScreensCopy {
  const overrides = typeof input === 'function' ? input(locale) : input
  const base = screensCopyFor(locale)
  return overrides === undefined ? base : merge(base, overrides)
}
