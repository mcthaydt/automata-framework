<script lang="ts">
  import type { OrchestratorView } from './orchestrator'
  let { title, view, showPlay, onplay, onrestart, stage = $bindable() }: {
    title: string; view: OrchestratorView; showPlay: boolean; onplay: () => void; onrestart: () => void; stage?: HTMLElement
  } = $props()
</script>
<section class="preview-panel" aria-label="Preview">
  <div class="preview-toolbar">
    <strong><span class="led" data-state={view.preview === 'running' ? 'live' : view.preview === 'starting' ? 'loading' : 'idle'}></span>Preview</strong>
    {#if view.runId > 0}<button type="button" onclick={onrestart}>Restart</button>{/if}
  </div>
  <div class="preview-box">
    {#if view.runId === 0}<div class="poster" data-testid="preview-poster"><p>{title}</p></div>{/if}
    <div class="frames" bind:this={stage}></div>
    {#if view.stopped}<p class="stopped">{view.stopped}</p>{/if}
    {#if showPlay}<button type="button" class="play" onclick={onplay}>Play</button>{/if}
  </div>
</section>
<style>
  .preview-panel { min-width: 0; border-radius: var(--radius); overflow: hidden; background: var(--charcoal); color: var(--stage-ink); }
  .preview-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 .5rem 0 1rem; min-height: 52px; border-bottom: 1px solid rgb(255 255 255 / .08); } /* taste-skill-ignore: data-ui demo cabinet */
  .preview-toolbar strong { display: inline-flex; align-items: center; gap: .65rem; font-size: var(--step-small); font-weight: 600; }
  .preview-toolbar button { min-height: 44px; padding: .4rem 1rem; border: 1px solid rgb(255 255 255 / .12); border-radius: var(--pill); background: rgb(255 255 255 / .04); color: var(--stage-ink); font-size: .875rem; }
  .preview-box { position: relative; width: 100%; aspect-ratio: 16 / 10; background: #12201f; }
  .poster { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; padding: 1.5rem; text-align: center; font-size: var(--step-body); }
  .poster p { max-width: 28ch; }
  .frames { position: absolute; inset: 0; }
  .frames :global(iframe) { position: absolute; inset: 0; display: block; width: 100%; height: 100%; border: 0; z-index: 0; }
  .frames :global(iframe.shown) { z-index: 1; }
  .stopped { position: absolute; left: .75rem; right: .75rem; bottom: .75rem; z-index: 3; margin: 0; padding: .6rem .9rem; border-radius: var(--radius-sm); background: rgb(17 21 28 / .85); overflow-wrap: anywhere; }
  .play { position: absolute; left: 50%; top: 50%; z-index: 4; transform: translate(-50%, -50%); min-height: 48px; padding: .6rem 1.6rem; border: 0; border-radius: var(--pill); background: var(--lime); color: var(--charcoal); font-weight: 600; }
  .preview-panel :focus-visible { outline-color: var(--lime); outline-offset: 2px; }
</style>
