<!--
  @component
  The Display section of Settings (M4 spec §4.8, §7): the graphics quality tier as an option group (a pad's `adjust`
  cycles it), and reduced motion as the browser reports it. Reduced motion is the player's system setting, so it is
  shown and never changed here.
-->
<script lang="ts">
import OptionGroup from '../../../shared/ui/layout/OptionGroup.svelte'
import { DISPLAY_QUALITIES, type DisplayCopy, type DisplayQuality } from './display-section'

interface Props {
  copy: DisplayCopy
  quality: DisplayQuality
  onquality: (quality: DisplayQuality) => void
  /** `prefers-reduced-motion`, as the browser reports it. */
  reducedMotion: boolean
}

const { copy, quality, onquality, reducedMotion }: Props = $props()
</script>

<section class="af-display" data-settings-section="display">
  <h3 class="af-settings__heading">{copy.title}</h3>
  <OptionGroup
    label={copy.quality}
    options={DISPLAY_QUALITIES.map((tier) => ({ value: tier, label: copy.qualities[tier], testId: `quality-${tier}` }))}
    value={quality}
    onchange={(tier) => onquality(tier as DisplayQuality)}
  />
  <p class="af-display__motion" data-display-motion>{copy.reducedMotion(reducedMotion)}</p>
</section>

<style>
  .af-display {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .af-display__motion {
    margin: 0;
    color: var(--af-ink);
    font: var(--af-text-small) / 1.4 var(--af-font);
  }
</style>
