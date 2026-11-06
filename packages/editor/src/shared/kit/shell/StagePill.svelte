<!--
  The pill that floats over an editor's stage (spec 11.4): one row of controls, centred at the stage's top from an
  iPad up and at its foot on a phone, under the thumb (`at`). The Level view's tools live in one; Map, Tiles and
  Characters put the buttons that open their list and their details in one, so every view has the same frame.

  It is a sibling of the stage's surface, never inside it, so a press on it never reaches the stage's gestures; the
  host gives the stage `position: relative`. It is never wider than the stage less a margin each side. If a narrow
  stage still cannot hold it, it scrolls sideways (a declared scroll region) rather than shrinking a control under
  44 px, and shows no scroll bar: macOS draws an overlay bar along a scrolling row's bottom edge and WebKit hit-tests
  it (about 15 px; #272), which would take a control's lower taps.
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  /** The toolbar's accessible name ("Tools", "Map controls"). */
  label: string
  /** Where the pill floats: the stage's top, or its foot (a phone). */
  at?: 'top' | 'bottom'
  testId?: string | undefined
  children: Snippet
}

const { label, at = 'bottom', testId, children }: Props = $props()
</script>

<div
  class="stage-pill"
  role="toolbar"
  aria-label={label}
  data-floating="true"
  data-at={at}
  data-testid={testId}
  data-scroll-region="both"
>
  {@render children()}
</div>

<style>
  .stage-pill {
    position: absolute;
    bottom: var(--space-3);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0;
    box-sizing: border-box;
    max-width: calc(100% - 2 * var(--space-3));
    padding: var(--space-1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    border: 1px solid var(--line);
    border-radius: var(--edge-lg);
    background: var(--paper);
  }
  .stage-pill[data-at='top'] {
    top: var(--space-3);
    bottom: auto;
  }
  /* The pill stays in the part of the stage that an open drawer or sheet leaves, so the button that closes it (and
     the Map's Fit) is never under it. On an iPad a drawer covers one edge of the stage, `--shell-drawer` wide: the pill
     centres in what is left. On a phone a sheet rises from the foot: the pill moves to the top while one is open. */
  :global(.shell[data-mode='medium']:has([data-region='inspector'][data-open='true'])) .stage-pill {
    left: calc((100% - var(--shell-drawer)) / 2);
  }
  :global(.shell[data-mode='medium']:has([data-region='panel'][data-open='true'])) .stage-pill {
    left: calc(var(--shell-drawer) + (100% - var(--shell-drawer)) / 2);
  }
  :global(
      .shell[data-mode='medium']:has([data-region='panel'][data-open='true']):has(
          [data-region='inspector'][data-open='true']
        )
    )
    .stage-pill {
    left: 50%;
  }
  :global(.shell[data-mode='compact']:has(:is([data-region='panel'], [data-region='inspector'])[data-open='true']))
    .stage-pill {
    top: var(--space-3);
    bottom: auto;
  }
  .stage-pill::-webkit-scrollbar {
    display: none;
  }
  /* Each item keeps its own width, so the pill scrolls instead of squeezing a control under its neighbour. */
  .stage-pill > :global(*) {
    flex: 0 0 auto;
  }
  /* The pill is the frame, so a segmented control inside it draws none of its own: a phone gets its 18 px. */
  .stage-pill :global(.segmented) {
    gap: 0;
    padding: 0;
    border: 0;
  }
</style>
