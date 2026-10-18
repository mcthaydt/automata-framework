<!--
  The default Settings screen (M4 spec §4.8, M4-D8), in FloorFifty's two tabs (`SettingsPanel.svelte` at a28dc44):
  Settings holds Language, Audio (M5.4), Display, Touch controls (on a coarse pointer, when the game offers buttons and swipes), then every
  component the extensions put in the `settings.sections` slot; Controls holds the controls by device, when the game
  has an input map. `view` is the screen's live state
  (`settings-screen.svelte.ts`), so a rebind, a device switch or a capture's countdown updates in place.
-->
<script lang="ts">
import {
  AudioSection,
  type AudioSectionChange,
  ControlsSection,
  type ControlsTouchMode,
  type DisplayQuality,
  DisplaySection,
  type InputMethodTracker,
  LanguageSection,
  type RebindDevice,
  SettingsScreen,
  type SettingsSection,
  type SettingsTab,
  TouchSection,
  type UiComponent,
} from '@mcthaydt/automata-ui'
import {
  AUDIO_COPY,
  CONTROLS_COPY,
  DISPLAY_COPY,
  LANGUAGE_COPY,
  PROMPT_COPY,
  SETTINGS_COPY,
  TOUCH_COPY,
} from './settings-copy.ts'
import type { SettingsViewState } from './settings-view.ts'

interface Props {
  view: SettingsViewState
  /** The device in the player's hand, whose section leads the Controls tab. */
  tracker: InputMethodTracker
  extensions: readonly UiComponent[]
  onrebind: (action: string, device: RebindDevice) => void
  onreset: () => void
  ontouchmode: (mode: ControlsTouchMode) => void
  onquality: (quality: DisplayQuality) => void
  /** A change in the Audio group (M5.4), applied and saved by the screen. */
  onaudio: (change: AudioSectionChange) => void
  /** A pick in the Language group: a locale, or null for Automatic (`Locale.set`). */
  onlocale: (choice: string | null) => void
  onback: () => void
}

const {
  view,
  tracker,
  extensions,
  onrebind,
  onreset,
  ontouchmode,
  onquality,
  onaudio,
  onlocale,
  onback,
}: Props = $props()

const tabs = $derived<SettingsTab[]>([
  {
    id: 'settings',
    label: SETTINGS_COPY.settingsTab,
    sections: [
      { snippet: language },
      { snippet: audio },
      { snippet: display },
      ...(view.coarse && view.touchModes.length > 1 ? [{ snippet: touch }] : []),
      ...extensions.map((component): SettingsSection => ({ component })),
    ],
  },
  ...(view.rows === undefined
    ? []
    : [{ id: 'controls', label: SETTINGS_COPY.controlsTab, sections: [{ snippet: controls }] }]),
])
</script>

{#snippet controls()}
  <ControlsSection
    rows={view.rows ?? []}
    devices={view.devices}
    touch={view.coarse || tracker.method === 'touch' ? (view.rows ?? []).some((row) => row.binding.touch) : false}
    inUse={tracker.method}
    glyphs={view.glyphs}
    promptCopy={PROMPT_COPY}
    layout={view.layout}
    copy={CONTROLS_COPY}
    state={view.controls}
    {onrebind}
    {onreset}
  />
{/snippet}

{#snippet touch()}
  <TouchSection copy={TOUCH_COPY} modes={view.touchModes} value={view.touchMode} onchange={ontouchmode} />
{/snippet}

{#snippet language()}
  <LanguageSection copy={LANGUAGE_COPY} locales={view.locales} choice={view.localeChoice} onchange={onlocale} />
{/snippet}

{#snippet audio()}
  <AudioSection
    copy={AUDIO_COPY}
    value={view.audio}
    available={view.audioAvailable}
    hostBelowFull={view.hostVolumeBelowFull}
    onchange={onaudio}
  />
{/snippet}

{#snippet display()}
  <DisplaySection copy={DISPLAY_COPY} quality={view.quality} {onquality} reducedMotion={view.reducedMotion} />
{/snippet}

<div class="af-game-menu" data-game-screen="settings">
  <SettingsScreen
    title={SETTINGS_COPY.title}
    backLabel={SETTINGS_COPY.back}
    {onback}
    {tabs}
    tabsLabel={SETTINGS_COPY.tabs}
    moreLabel={SETTINGS_COPY.more}
  />
</div>
