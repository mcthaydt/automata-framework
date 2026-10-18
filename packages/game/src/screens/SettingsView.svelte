<!--
  The default Settings screen (M4 spec §4.8, M4-D8), in FloorFifty's two tabs (`SettingsPanel.svelte` at a28dc44):
  Settings holds Display, then every component the extensions put in the `settings.sections` slot; Controls holds
  the controls, when the game has an input map. `view` is the screen's live state
  (`settings-screen.svelte.ts`), so a rebind, a device switch or a capture's countdown updates in place.
-->
<script lang="ts">
import {
  ControlsSection,
  type ControlsTouchMode,
  type DisplayQuality,
  DisplaySection,
  type RebindDevice,
  SettingsScreen,
  type SettingsSection,
  type SettingsTab,
  type UiComponent,
} from '@mcthaydt/automata-ui'
import { CONTROLS_COPY, DISPLAY_COPY, PROMPT_COPY, SETTINGS_COPY } from './settings-copy.ts'
import type { SettingsViewState } from './settings-view.ts'

interface Props {
  view: SettingsViewState
  extensions: readonly UiComponent[]
  onrebind: (action: string, device: RebindDevice) => void
  onreset: () => void
  ontouchmode: (mode: ControlsTouchMode) => void
  onquality: (quality: DisplayQuality) => void
  onback: () => void
}

const { view, extensions, onrebind, onreset, ontouchmode, onquality, onback }: Props = $props()

const tabs = $derived<SettingsTab[]>([
  {
    id: 'settings',
    label: SETTINGS_COPY.settingsTab,
    sections: [{ snippet: display }, ...extensions.map((component): SettingsSection => ({ component }))],
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
    glyphs={view.glyphs}
    promptCopy={PROMPT_COPY}
    layout={view.layout}
    copy={CONTROLS_COPY}
    state={view.controls}
    touch={{ modes: view.touchModes, value: view.touchMode, onchange: ontouchmode }}
    {onrebind}
    {onreset}
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
