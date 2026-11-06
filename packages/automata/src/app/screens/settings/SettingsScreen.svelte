<!--
  @component
  The core Settings screen, laid out as a dialog over the dimmed game
  (Owner 2026-10-18: "match the layout and function, not the style"): a dialog over the dimmed game, the same frame as Paused, so going between them reads as
  one dialog changing its view. Tabs stay put and the chosen tab's sections scroll under them in one list that counts
  what is below; Back sits under the dialog, and Escape and the dialog's Close go back too. Where the dialog is 560 px
  wide (it widens on a short band) the sections go two across. The default screens give it Display and Controls;
  extensions add theirs to the Settings tab through the `settings.sections` slot. A kit's styled screen replaces it
  by flow.
-->
<script lang="ts">
import Modal from '../../../shared/ui/dialog/Modal.svelte'
import ScrollList from '../../../shared/ui/layout/ScrollList.svelte'
import type { SettingsTab } from './settings-screen'

interface Props {
  title: string
  backLabel: string
  onback: () => void
  /** The tabs, the first shown first: the default screens' Settings, then Controls. */
  tabs: readonly SettingsTab[]
  /** The tab list's accessible name. */
  tabsLabel: string
  /** "+N more", in the game's language. */
  moreLabel: (count: number) => string
}

const { title, backLabel, onback, tabs, tabsLabel, moreLabel }: Props = $props()

// The tab chosen; the first until the player picks another. A tab that goes away falls back to the first.
let chosen = $state<string | undefined>(undefined)
const current = $derived(tabs.find((tab) => tab.id === chosen) ?? tabs[0])
</script>

{#snippet head()}
  <div class="af-settings__tabs" role="tablist" aria-label={tabsLabel}>
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        role="tab"
        class="af-control af-control--ghost af-settings__tab"
        data-testid={`settings-tab-${tab.id}`}
        aria-selected={tab.id === current?.id}
        onclick={() => (chosen = tab.id)}>{tab.label}</button
      >
    {/each}
  </div>
{/snippet}

<Modal {title} closeLabel={backLabel} onclose={onback} testId="settings-screen" wide fill head={tabs.length > 1 ? head : undefined}>
  <div class="af-settings">
    {#if current !== undefined}
      {#key current.id}
        <div class="af-settings__panel" role="tabpanel" data-settings-tab={current.id}>
          <ScrollList
            minRows={1}
            rowCount={current.sections.length}
            rowGap="16px"
            label={current.label}
            {moreLabel}
          >
            {#snippet children()}
              <div class="af-settings__sections">
                {#each current.sections as section, index (index)}
                  <div class="af-settings__section" data-row>
                    {#if 'snippet' in section}
                      {@render section.snippet()}
                    {:else}
                      <section.component />
                    {/if}
                  </div>
                {/each}
              </div>
            {/snippet}
          </ScrollList>
        </div>
      {/key}
    {/if}
  </div>
  {#snippet actions()}
    <button type="button" class="af-control af-control--ghost af-settings__back" data-testid="settings-back" onclick={onback}>
      <span aria-hidden="true">←</span>
      {backLabel}
    </button>
  {/snippet}
</Modal>

<style>
  /* On a short or compact band the list keeps the row Back would take: the dialog's Close, named Back, does the same,
     so the title screen's Settings shows only the Close. A tall band draws both, as the pause menu does. */
  :global(:is([data-height='short'], [data-height='compact'])) :global(.af-modal__actions:has(> .af-settings__back)) {
    display: none;
  }

  /* A column the list takes the rest of: on a short dialog the list shrinks to its reserve before the tabs move. */
  .af-settings {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    height: 100%;
  }

  /* Tabs too wide for one row (a long language on a narrow dialog) wrap to a second, whole and reachable, rather than
     widening the dialog past the screen. */
  .af-settings__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .af-settings__tab[aria-selected='true'] {
    border-color: var(--af-accent);
    box-shadow: inset 0 -3px 0 var(--af-accent);
  }

  .af-settings__panel {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
  }

  .af-settings__panel > :global(*) {
    flex: 1 1 auto;
  }

  /* One column the list's width: a group's widest row (a long language's words) wraps or gives way inside it, rather
     than widening the column past the list's side, where its options would be cut. */
  .af-settings__sections {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }

  /* Two sections across where the dialog is wide enough (Language beside Audio, Display beside Touch). */
  @container af-dialog (min-width: 560px) {
    .af-settings__sections {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-items: start;
      column-gap: 24px;
    }
    /* A tab of one section (Controls) takes the width: the Controls tab is one column. */
    .af-settings__section:only-child {
      grid-column: 1 / -1;
    }
  }

  .af-settings__section :global(.af-settings__heading) {
    margin: 0;
    font: 700 var(--af-text-body) / 1.3 var(--af-font);
  }
</style>
