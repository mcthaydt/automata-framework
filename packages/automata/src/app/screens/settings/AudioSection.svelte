<!--
  @component
  The Audio group of the Settings tab, in order: Mute, Mute in the background, then a slider per bus with its percentage. Every change is reported at
  once (`onchange`); the game applies and saves it, so there is no Apply. When sound could not start
  (`available` false, A-e) the group says so and its controls stay shown but disabled. While the host's own volume is
  below full, a note says it also applies, so a quiet game is not taken for a broken slider.
-->
<script lang="ts">
import Slider from '../../../shared/ui/controls/Slider.svelte'
import Toggle from '../../../shared/ui/controls/Toggle.svelte'
import {
  AUDIO_BUSES,
  type AudioBus,
  type AudioCopy,
  type AudioSectionChange,
  type AudioValue,
} from './audio-section'

interface Props {
  copy: AudioCopy
  value: AudioValue
  /** False when sound could not start on this device (`audio.unavailable`). */
  available: boolean
  /** The host's volume is below full (`Hosting.audio`). */
  hostBelowFull: boolean
  onchange: (change: AudioSectionChange) => void
  /** A bus's slider let go: play its sample (`Audio.sample`), so the player hears the level set. */
  onsample?: ((bus: AudioBus) => void) | undefined
}

const { copy, value, available, hostBelowFull, onchange, onsample }: Props = $props()
</script>

<section class="af-audio" data-settings-section="audio">
  <h3 class="af-settings__heading">{copy.title}</h3>
  {#if !available}
    <p class="af-audio__note" role="status" data-audio-unavailable>{copy.unavailable}</p>
  {/if}
  <Toggle
    label={copy.mute}
    checked={value.muted}
    onLabel={copy.on}
    offLabel={copy.off}
    disabled={!available}
    testId="audio-muted"
    onchange={(muted) => onchange({ kind: 'muted', value: muted })}
  />
  <Toggle
    label={copy.muteUnfocused}
    checked={value.muteUnfocused}
    onLabel={copy.on}
    offLabel={copy.off}
    disabled={!available}
    testId="audio-mute-unfocused"
    onchange={(muteUnfocused) => onchange({ kind: 'muteUnfocused', value: muteUnfocused })}
  />
  {#each AUDIO_BUSES as bus (bus)}
    <div data-audio-bus={bus}>
      <Slider
        label={copy.buses[bus]}
        value={value.gains[bus]}
        min={0}
        max={1}
        step={0.05}
        valueText={copy.percent}
        disabled={!available}
        layout="row"
        onchange={(gain) => onchange({ kind: 'gain', bus, value: gain })}
        onrelease={() => onsample?.(bus)}
      />
    </div>
  {/each}
  {#if hostBelowFull}
    <p class="af-audio__note" data-audio-host-volume>{copy.hostVolume}</p>
  {/if}
</section>

<style>
  .af-audio {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .af-audio__note {
    margin: 0;
    color: var(--af-ink);
    font: var(--af-text-small) / 1.4 var(--af-font);
  }
</style>
