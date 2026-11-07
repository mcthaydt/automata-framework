<!--
  @component
  The settings screen (PRODUCT.6): core's SettingsScreen with the game's own tabs, its words taken from core's
  `ScreensCopy['settings']['screen']`. Core's screen is the presentation (the dialog, the tabs, the sections that scroll); the
  sections' wiring (audio, display, controls, language) is the game's state, so a game builds its `tabs` from core's section
  components and adds its own tab or section here without touching core.
-->
<script lang="ts">
import { SettingsScreen as CoreSettings, type SettingsTab } from '@automata/framework'

/** Core's `ScreensCopy['settings']['screen']`. */
export interface SettingsCopy {
  readonly title: string
  readonly back: string
  readonly tabs: string
  readonly more: (count: number) => string
}

interface Props {
  copy: SettingsCopy
  tabs: readonly SettingsTab[]
  onBack: () => void
}

const { copy, tabs, onBack }: Props = $props()
</script>

<div class="settings" data-game-screen="settings">
  <CoreSettings title={copy.title} backLabel={copy.back} onback={onBack} {tabs} tabsLabel={copy.tabs} moreLabel={copy.more} />
</div>
