<!--
  @component
  The core Settings screen (M4 spec §4.8, M4-D8): the screen frame with Back in its corner row, the title, and the
  sections as rows of one scroll list, so on a short screen the list scrolls and Back stays put. The default screens
  give it Controls and Display; extensions add theirs through the `settings.sections` slot. A kit's styled screen
  replaces it by flow (PRODUCT.6).
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import ScreenFrame from '../layout/ScreenFrame.svelte'
import ScrollList from '../layout/ScrollList.svelte'

interface Props {
  title: string
  backLabel: string
  onback: () => void
  sections: readonly Snippet[]
  /** The list's accessible name. */
  listLabel: string
  /** "+N more", in the game's language. */
  moreLabel: (count: number) => string
}

const { title, backLabel, onback, sections, listLabel, moreLabel }: Props = $props()
</script>

<ScreenFrame arrangement="stack" back={onback} {backLabel} testId="settings-screen">
  {#snippet body()}
    <div class="af-settings">
      <h2 class="af-settings__title">{title}</h2>
      <ScrollList minRows={1} rowCount={sections.length} rowGap="16px" label={listLabel} {moreLabel}>
        {#snippet children()}
          <div class="af-settings__sections">
            {#each sections as section, index (index)}
              <div class="af-settings__section" data-row>{@render section()}</div>
            {/each}
          </div>
        {/snippet}
      </ScrollList>
    </div>
  {/snippet}
</ScreenFrame>

<style>
  .af-settings {
    display: grid;
    grid-template-rows: auto 1fr;
    gap: 8px;
    height: 100%;
    min-height: 0;
  }

  .af-settings__title {
    margin: 0;
    font: 700 var(--af-text-body) / 1.3 var(--af-font);
  }

  .af-settings__sections {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .af-settings__section :global(.af-settings__heading) {
    margin: 0;
    font: 700 var(--af-text-body) / 1.3 var(--af-font);
  }
</style>
