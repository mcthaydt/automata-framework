<!--
  The default Settings screen (M4 spec §4.8, M4-D8), in FloorFifty's two tabs (`SettingsPanel.svelte` at a28dc44):
  Settings holds Language, Audio (M5.4), Vibration (where the device can), Display, Touch controls (on a coarse pointer, when the game offers buttons and swipes), then every
  component the extensions put in the `settings.sections` slot; Controls holds the controls by device, when the game
  has an input map. `view` is the screen's live state
  (`settings-screen.svelte.ts`), so a rebind, a device switch or a capture's countdown updates in place.
-->
<script lang="ts">
import { type InputMethodTracker } from '../../../shared/ui/browser/input-method.svelte'
import { type UiComponent } from '../../../shared/ui/slots/ui-slot'
import type { LiveScreensCopy } from '../../screens/screens-copy.svelte.ts'
import AudioSection from './AudioSection.svelte'
import { type AudioBus, type AudioSectionChange } from './audio-section'
import ControlsSection from './ControlsSection.svelte'
import { type ControlsTouchMode, type RebindDevice } from './controls-section'
import DisplaySection from './DisplaySection.svelte'
import { type DisplayQuality } from './display-section'
import LanguageSection from './LanguageSection.svelte'
import SettingsScreen from './SettingsScreen.svelte'
import { type SettingsSection, type SettingsTab } from './settings-screen'
import type { SettingsViewState } from './settings-view.ts'
import TouchSection from './TouchSection.svelte'
import VibrationSection from './VibrationSection.svelte'

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
  /** A volume let go: its sample (`Audio.sample`). */
  onsample: (bus: AudioBus) => void
  /** A pick in the Language group: a locale, or null for Automatic (`Locale.set`). */
  onlocale: (choice: string | null) => void
  /** The Vibration toggle (`Haptics.setEnabled`), applied and saved by the screen. */
  onhaptics: (enabled: boolean) => void
  onback: () => void
  /** The screens' words in the player's language (DX.2d). */
  copy: LiveScreensCopy
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
  onhaptics,
  onsample,
  onback,
  copy,
}: Props = $props()
const words = $derived(copy.current.settings)

const tabs = $derived<SettingsTab[]>([
  {
    id: 'settings',
    label: words.screen.settingsTab,
    sections: [
      { snippet: language },
      { snippet: audio },
      ...(view.hapticsSupported ? [{ snippet: vibration }] : []),
      { snippet: display },
      ...(view.coarse && view.touchModes.length > 1 ? [{ snippet: touch }] : []),
      ...extensions.map((component): SettingsSection => ({ component })),
    ],
  },
  ...(view.rows === undefined
    ? []
    : [{ id: 'controls', label: words.screen.controlsTab, sections: [{ snippet: controls }] }]),
])
</script>

{#snippet controls()}
  <ControlsSection
    rows={view.rows ?? []}
    devices={view.devices}
    touch={view.coarse || tracker.method === 'touch' ? (view.rows ?? []).some((row) => row.binding.touch) : false}
    inUse={tracker.method}
    glyphs={view.glyphs}
    promptCopy={words.prompts}
    layout={view.layout}
    copy={words.controls}
    state={view.controls}
    {onrebind}
    {onreset}
  />
{/snippet}

{#snippet touch()}
  <TouchSection copy={words.touch} modes={view.touchModes} value={view.touchMode} onchange={ontouchmode} />
{/snippet}

{#snippet language()}
  <LanguageSection copy={words.language} locales={view.locales} choice={view.localeChoice} onchange={onlocale} />
{/snippet}

{#snippet vibration()}
  <VibrationSection copy={words.vibration} enabled={view.hapticsEnabled} onchange={onhaptics} />
{/snippet}

{#snippet audio()}
  <AudioSection
    copy={words.audio}
    value={view.audio}
    available={view.audioAvailable}
    hostBelowFull={view.hostVolumeBelowFull}
    onchange={onaudio}
    {onsample}
  />
{/snippet}

{#snippet display()}
  <DisplaySection copy={words.display} quality={view.quality} {onquality} reducedMotion={view.reducedMotion} />
{/snippet}

<div class="af-game-menu" data-game-screen="settings">
  <SettingsScreen
    title={words.screen.title}
    backLabel={words.screen.back}
    {onback}
    {tabs}
    tabsLabel={words.screen.tabs}
    moreLabel={words.screen.more}
  />
</div>
