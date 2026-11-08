<!--
  The core Settings screen for the layout contracts, in two tabs: `settings` shows
  the Settings tab (Language, Audio, Vibration, Display, Touch controls, in the order a player expects); `controls` the Controls tab with four actions, both devices and touch; `controls-capturing`
  shows its first row waiting for a press; `settings-short` the Settings tab with Display alone, for the sheet's height. Words are English stand-ins of a typical length, said in the `locale` the contract runs in.
-->
<script lang="ts" module>
export const SETTINGS_SHOWS = ['settings', 'settings-short', 'controls', 'controls-capturing'] as const
export type SettingsShow = (typeof SETTINGS_SHOWS)[number]
</script>

<script lang="ts">
import type { PromptCopy } from '../../shared/ui/prompts/prompt-label'
import ControlsSection from '../../app/screens/settings/ControlsSection.svelte'
import type { ControlsCopy, ControlsRow } from '../../app/screens/settings/controls-section'
import AudioSection from '../../app/screens/settings/AudioSection.svelte'
import DisplaySection from '../../app/screens/settings/DisplaySection.svelte'
import LanguageSection from '../../app/screens/settings/LanguageSection.svelte'
import VibrationSection from '../../app/screens/settings/VibrationSection.svelte'
import TouchSection from '../../app/screens/settings/TouchSection.svelte'
import type { DisplayCopy } from '../../app/screens/settings/display-section'
import SettingsScreen from '../../app/screens/settings/SettingsScreen.svelte'
import { type FixtureLocale, say } from './locale-fixture'

const { show, locale = 'en' }: { show: SettingsShow; locale?: FixtureLocale } = $props()
/** A word in the contract's locale, as a game's `t()` would give it. A fixture's props are fixed for its mount. */
const t = (text: string): string => say(locale, text)
const none = (): void => undefined

const PROMPT_COPY: PromptCopy = {
  unbound: t('Unbound'),
  touch: t('Tap'),
  pad: {
    bottom: t('Bottom button'),
    right: t('Right button'),
    left: t('Left button'),
    top: t('Top button'),
    leftBumper: t('Left bumper'),
    rightBumper: t('Right bumper'),
    leftTrigger: t('Left trigger'),
    rightTrigger: t('Right trigger'),
    select: t('Select'),
    start: t('Start'),
    leftStick: t('Left stick'),
    rightStick: t('Right stick'),
    home: t('Home'),
  },
}
const CONTROLS_COPY: ControlsCopy = {
  title: t('Controls'),
  keyboard: t('Keyboard'),
  gamepad: t('Controller'),
  touch: t('Touch'),
  inUse: t('In use'),
  reset: t('Reset controls'),
  press: t('Press…'),
  rebind: (action, device) => t(`Change ${action} on ${device}`),
  capturing: (action, device, seconds) => t(`Press a ${device} input for ${action} (${seconds} s)`),
  conflict: (action, other) => t(`${action} can't take that: ${other} would have nothing`),
  reserved: (action) => t(`That input is kept for menus; pick another for ${action}`),
  timedOut: (action) => t(`Nothing pressed; ${action} is unchanged`),
  saved: (action) => t(`${action} saved`),
}
const DISPLAY_COPY: DisplayCopy = {
  title: t('Display'),
  quality: t('Graphics quality'),
  qualities: { high: t('High'), medium: t('Medium'), low: t('Low') },
  reducedMotion: (reduced) => t(`Reduced motion: ${reduced ? 'on' : 'off'} (from your device)`),
}
const ROWS: ControlsRow[] = [
  { id: 'left', label: t('Move left'), binding: { keys: ['ArrowLeft'], pad: [14], touch: true } },
  { id: 'right', label: t('Move right'), binding: { keys: ['ArrowRight'], pad: [15], touch: true } },
  { id: 'jump', label: t('Jump'), binding: { keys: ['Space'], pad: [0], touch: true } },
  { id: 'fire', label: t('Fire'), binding: { keys: [], pad: [2], touch: false } },
]
</script>

{#snippet controls()}
  <ControlsSection
    rows={ROWS}
    devices={['keyboard', 'gamepad']}
    touch
    inUse="keyboard"
    glyphs="xbox"
    promptCopy={PROMPT_COPY}
    copy={CONTROLS_COPY}
    state={show === 'controls-capturing'
      ? { kind: 'capturing', action: 'left', device: 'keyboard', secondsLeft: 9 }
      : { kind: 'list' }}
    onrebind={none}
    onreset={none}
  />
{/snippet}

{#snippet touch()}
  <TouchSection
    copy={{
      title: t('Touch controls'),
      mode: t('Play with'),
      modes: { buttons: t('Buttons'), swipe: t('Swipe') },
    }}
    modes={['buttons', 'swipe']}
    value="buttons"
    onchange={none}
  />
{/snippet}

{#snippet language()}
  <LanguageSection
    copy={{ title: t('Language'), automatic: t('Automatic') }}
    locales={['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']}
    choice={null}
    onchange={none}
  />
{/snippet}

{#snippet vibration()}
  <VibrationSection
    copy={{ title: t('Vibration'), toggle: t('Rumble and vibration'), on: t('On'), off: t('Off') }}
    enabled
    onchange={none}
  />
{/snippet}

{#snippet audio()}
  <AudioSection
    copy={{
      title: t('Audio'),
      mute: t('Mute'),
      muteUnfocused: t('Mute in the background'),
      on: t('On'),
      off: t('Off'),
      buses: { master: t('Master'), music: t('Music'), sfx: t('Effects'), ui: t('Menus'), voice: t('Voices') },
      percent: (value) => `${Math.round(value * 100)}%`,
      unavailable: t('Sound could not start on this device.'),
      hostVolume: t('The host’s volume also applies.'),
    }}
    value={{ muted: false, muteUnfocused: false, gains: { master: 1, music: 0.8, sfx: 1, ui: 0.6, voice: 1 } }}
    available
    hostBelowFull={false}
    onchange={none}
  />
{/snippet}

{#snippet display()}
  <DisplaySection copy={DISPLAY_COPY} quality="high" onquality={none} reducedMotion={false} />
{/snippet}

<SettingsScreen
  title={t('Settings')}
  backLabel={t('Back')}
  onback={none}
  tabs={[
    {
      id: 'settings',
      label: t('Settings'),
      sections: show === 'settings-short' ? [{ snippet: display }] : [
        { snippet: language },
        { snippet: audio },
        { snippet: vibration },
        { snippet: display },
        { snippet: touch },
      ],
    },
    { id: 'controls', label: t('Controls'), sections: [{ snippet: controls }] },
  ]}
  tabsLabel={t('Settings sections')}
  moreLabel={(count) => t(`+${count} more`)}
/>
