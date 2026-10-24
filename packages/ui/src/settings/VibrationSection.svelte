<!--
  @component
  The Vibration group of the Settings tab (Owner, 2026-10-18; FloorFifty's rumble row in `SettingsPanel.svelte` at
  a28dc44): one toggle for a pad's rumble and a phone's buzz (`Haptics`). The game shows it only where the device can
  do either (`Haptics.supported`), so it never offers a switch that does nothing.
-->
<script lang="ts">
import Toggle from '../controls/Toggle.svelte'
import type { VibrationCopy } from './vibration-section'

interface Props {
  copy: VibrationCopy
  enabled: boolean
  onchange: (enabled: boolean) => void
}

const { copy, enabled, onchange }: Props = $props()
</script>

<section class="af-vibration" data-settings-section="vibration">
  <h3 class="af-settings__heading">{copy.title}</h3>
  <Toggle
    label={copy.toggle}
    checked={enabled}
    onLabel={copy.on}
    offLabel={copy.off}
    testId="vibration-enabled"
    {onchange}
  />
</section>

<style>
  .af-vibration {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
