<!--
  @component
  The Touch controls group of the Settings tab (FloorFifty `SettingsPanel.svelte` at a28dc44): how touch drives play,
  on-screen buttons or swipes, as an option group. The game shows it on a coarse pointer when it offers both modes.
-->
<script lang="ts">
import OptionGroup from '../../../shared/ui/layout/OptionGroup.svelte'
import type { ControlsTouchMode } from './controls-section'
import type { TouchCopy } from './touch-section'

interface Props {
  copy: TouchCopy
  modes: readonly ControlsTouchMode[]
  value: ControlsTouchMode
  onchange: (mode: ControlsTouchMode) => void
}

const { copy, modes, value, onchange }: Props = $props()
</script>

<section class="af-touch" data-settings-section="touch">
  <h3 class="af-settings__heading">{copy.title}</h3>
  <OptionGroup
    label={copy.mode}
    options={modes.map((mode) => ({ value: mode, label: copy.modes[mode], testId: `touch-mode-${mode}` }))}
    {value}
    onchange={(mode) => onchange(mode as ControlsTouchMode)}
  />
</section>

<style>
  .af-touch {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
