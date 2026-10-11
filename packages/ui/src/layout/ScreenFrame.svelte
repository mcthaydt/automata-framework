<!--
  Every screen's frame (M1.6 spec §3.4; from FloorFifty `ui/layout/ScreenFrame.svelte` at 122a220).

  It fills the visible region: the layout viewport less the insets the geometry owner publishes
  (safe area and Ruken's reserved strip), ending above whatever the browser lays over the page's
  foot (the keyboard). Its first row is the corner controls, in flow, so they never sit over the
  content. Below that it arranges a hero and a body:
    stack: hero above body; the hero takes what the body leaves, so on a short screen the hero
           shrinks first and never pushes the body off the screen;
    split: hero and body side by side.
  The screen root picks the arrangement from the form factor and height tier; nothing inside the
  frame branches on either. The body is the `af-screen` size container its contents query.
-->
<script lang="ts">
import type { Snippet } from 'svelte'
import CornerControls from './CornerControls.svelte'

interface Props {
  arrangement: 'stack' | 'split'
  body: Snippet
  hero?: Snippet | undefined
  actions?: Snippet | undefined
  back?: (() => void) | undefined
  backLabel?: string | undefined
  header?: Snippet | undefined
  /** The game's corner controls, at the end of the corner row (Mute, a language flag). */
  end?: Snippet | undefined
  testId?: string | undefined
}

const { arrangement, body, hero, actions, back, backLabel, header, end, testId }: Props = $props()

// The geometry owner marks the root with `data-visual-inset` while the browser lays something over
// the page's foot (the keyboard). Only then is the frame shorter than what it holds, and only then
// does it scroll and say so: `data-scroll-region` is what the layout check reads (spec §3.10). At
// rest it is not a scroll region, so everything in it has to fit.
const root = typeof document === 'undefined' ? undefined : document.documentElement
const covered = (): boolean => root?.hasAttribute('data-visual-inset') ?? false
let scrolls = $state(covered())

$effect(() => {
  if (root === undefined) return
  const watch = new MutationObserver(() => {
    scrolls = covered()
  })
  watch.observe(root, { attributes: true, attributeFilter: ['data-visual-inset'] })
  scrolls = covered()
  return () => watch.disconnect()
})
</script>

<div
  class="af-screen-frame"
  data-screen-frame
  data-arrangement={arrangement}
  data-scroll-region={scrolls ? '' : undefined}
  data-testid={testId}
>
  <CornerControls {back} {backLabel} {header} {end} />
  <div class="af-screen-frame__content">
    {#if hero}
      <div class="af-screen-frame__hero">{@render hero()}</div>
    {/if}
    <div class="af-screen-frame__body">
      {@render body()}
      {#if actions}
        <div class="af-screen-frame__actions">{@render actions()}</div>
      {/if}
    </div>
  </div>
</div>

<style>
  /* The insets come from the geometry owner; without one (a bare fixture) the browser's env(). */
  .af-screen-frame {
    position: fixed;
    inset: 0 0 var(--af-visual-inset-bottom, 0px);
    box-sizing: border-box;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--af-gutter);
    padding: max(var(--af-gutter), var(--af-inset-top, env(safe-area-inset-top, 0px)))
      max(var(--af-gutter), var(--af-inset-right, env(safe-area-inset-right, 0px)))
      max(var(--af-gutter), var(--af-inset-bottom, env(safe-area-inset-bottom, 0px)))
      max(var(--af-gutter), var(--af-inset-left, env(safe-area-inset-left, 0px)));
  }

  /* At rest everything fits. While the browser lays something over the page's foot the frame is
     shorter than what it holds, and it scrolls what does not fit into view rather than leaving an
     action under the keyboard. */
  .af-screen-frame[data-scroll-region] {
    overflow-y: auto;
    overscroll-behavior: contain;
    /* The frame already ends above the keyboard, which covers the bottom safe area: padding by it
       too would waste that much of the little room left. */
    padding-bottom: var(--af-gutter);
  }

  .af-screen-frame__content {
    display: grid;
    gap: var(--af-gutter);
    min-height: 0;
    min-width: 0;
  }

  .af-screen-frame__hero {
    min-height: 0;
    min-width: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
  }

  .af-screen-frame__body {
    container: af-screen / size;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: var(--af-gutter);
    min-height: 0;
    min-width: 0;
  }

  .af-screen-frame__body:not(:has(> .af-screen-frame__actions)) {
    grid-template-rows: minmax(0, 1fr);
  }

  /* Stack: the hero takes what the body leaves. */
  .af-screen-frame[data-arrangement="stack"] .af-screen-frame__content {
    grid-template-rows: var(--af-stack-rows, minmax(0, 1fr) auto);
  }

  .af-screen-frame[data-arrangement="stack"] .af-screen-frame__content:not(:has(> .af-screen-frame__hero)) {
    grid-template-rows: minmax(0, 1fr);
  }

  /* A stack with a hero sizes its body to its content, and a size container has no content size:
     there the body measures its width only. */
  .af-screen-frame[data-arrangement="stack"] .af-screen-frame__content:has(> .af-screen-frame__hero) > .af-screen-frame__body {
    container-type: inline-size;
  }

  /* Split: hero and body side by side, the body's column allotted up to `--af-split-body`. */
  .af-screen-frame[data-arrangement="split"] .af-screen-frame__content {
    grid-template-columns: minmax(0, 1fr) minmax(0, var(--af-split-body, 24rem));
  }

  .af-screen-frame[data-arrangement="split"] .af-screen-frame__content:not(:has(> .af-screen-frame__hero)) {
    grid-template-columns: minmax(0, 1fr);
  }
</style>
