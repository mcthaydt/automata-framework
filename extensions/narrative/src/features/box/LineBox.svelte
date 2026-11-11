<!--
  @component
  The one box a line is drawn in: a speaker (or a title), the words, and whatever controls the caller puts inside. The
  dialogue box reads a conversation into it; the HUD's examine piece feeds it a line of its own, so there is one look, and
  the typed-out delivery lands in one component. By default it lies along the bottom of the play field; with `placed` its
  caller positions it (the HUD does, from its file).
-->
<script lang="ts">
import type { Snippet } from 'svelte'

interface Props {
  /** The speaker's name or the title; no line is drawn when it is absent. */
  speaker?: string | undefined
  text: string
  /** How many characters of `text` to show (a line being typed out); all by default. The rest keeps its room, unseen. */
  shown?: number | undefined
  /** The caller positions it (with `style`) instead of the bottom of the field. */
  placed?: boolean
  style?: string | undefined
  /** The box's element, for a caller that measures it. */
  element?: HTMLElement | undefined
  /** The controls under the words. */
  children?: Snippet
}

let { speaker, text, shown, placed = false, style, element = $bindable(), children }: Props = $props()
const seen = $derived(shown === undefined ? text : text.slice(0, shown))
const unseen = $derived(text.slice(seen.length))
</script>

<section
  class="af-dialogue-box"
  class:placed
  data-testid="dialogue-box"
  aria-live="polite"
  {style}
  bind:this={element}
>
  {#if speaker !== undefined && speaker !== ''}<p class="speaker" data-testid="dialogue-speaker">{speaker}</p>{/if}
  <p class="line" data-testid="dialogue-line"><span data-testid="dialogue-typed">{seen}</span><span class="unseen" aria-hidden="true">{unseen}</span></p>
  {@render children?.()}
</section>

<style>
  .af-dialogue-box {
    position: absolute;
    inset: auto 0 0;
    box-sizing: border-box;
    display: grid;
    gap: 8px;
    max-height: 100%;
    overflow-y: auto;
    padding: 12px var(--af-gutter, 16px);
    border: var(--af-edge-width, 2px) solid var(--af-edge, #a6aeba);
    border-radius: var(--af-radius, 6px);
    background: var(--af-surface, #181f2f);
    color: var(--af-ink, #f5f7fa);
    font: var(--af-text-body, 16px) / 1.4 var(--af-font, system-ui, sans-serif);
    pointer-events: auto;
  }
  /* The caller's style says where it is; the field's bottom edge no longer does. */
  .af-dialogue-box.placed {
    inset: auto;
  }
  /* The words still to come keep their room, so the box does not grow as the line is typed. */
  .unseen {
    visibility: hidden;
  }
  .speaker {
    margin: 0;
    color: var(--af-accent, #ffcf05);
    font-weight: 700;
  }
  .line {
    margin: 0;
    overflow-wrap: anywhere;
    min-height: 1.4em;
  }
</style>
