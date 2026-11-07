<script lang="ts">
import type { OrchestratorView } from './orchestrator'

let {
  title,
  view,
  showPlay,
  onplay,
  showRetry,
  onretry,
  onrestart,
  stage = $bindable(),
}: {
  title: string
  view: OrchestratorView
  showPlay: boolean
  onplay: () => void
  showRetry: boolean
  onretry: () => void
  onrestart: () => void
  stage?: HTMLElement
} = $props()

// F11: Fullscreen behaves as in DemoRunner. The panel goes fullscreen; a refusal, or no answer within 1 s, is said.
let panel: HTMLElement | undefined = $state()
let fullscreenMessage = $state('')
async function toggleFullscreen() {
  const impatient = setTimeout(() => {
    fullscreenMessage = FULLSCREEN_UNAVAILABLE
  }, 1_000)
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
    else await panel!.requestFullscreen()
    fullscreenMessage = ''
  } catch {
    fullscreenMessage = FULLSCREEN_UNAVAILABLE
  } finally {
    clearTimeout(impatient)
  }
}
const FULLSCREEN_UNAVAILABLE = 'Fullscreen is unavailable in this browser.'
</script>
<section class="preview-panel" aria-label="Preview" bind:this={panel}>
  <div class="preview-toolbar">
    <strong><span class="led" data-state={view.preview === 'running' ? 'live' : view.preview === 'starting' ? 'loading' : 'idle'}></span>Preview</strong>
    <span class="toolbar-actions">{#if view.runId > 0}<button type="button" onclick={onrestart}>Restart</button>{/if}<button type="button" onclick={toggleFullscreen}>Fullscreen</button></span>
  </div>
  {#if fullscreenMessage}<p class="fullscreen-message" role="status">{fullscreenMessage}</p>{/if}
  <div class="preview-box">
    {#if view.runId === 0}<div class="poster" data-testid="preview-poster"><p>{title}</p></div>{/if}
    <div class="frames" bind:this={stage}></div>
    {#if view.stopped}<p class="stopped">{view.stopped}</p>{/if}
    {#if showPlay}<button type="button" class="play" onclick={onplay}>Play</button>{/if}
    {#if showRetry}<button type="button" class="play" onclick={onretry}>Retry</button>{/if}
  </div>
</section>
<style>
  .preview-panel { min-width: 0; border-radius: var(--radius); overflow: hidden; background: var(--charcoal); color: var(--stage-ink); }
  .preview-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 .5rem 0 1rem; min-height: 52px; border-bottom: 1px solid rgb(255 255 255 / .08); } /* taste-skill-ignore: data-ui demo cabinet */
  .preview-toolbar strong { display: inline-flex; align-items: center; gap: .65rem; font-size: var(--step-small); font-weight: 600; }
  .preview-toolbar button { min-height: 44px; padding: .4rem 1rem; border: 1px solid rgb(255 255 255 / .12); border-radius: var(--pill); background: rgb(255 255 255 / .04); color: var(--stage-ink); font-size: .875rem; }
  .toolbar-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
  .fullscreen-message { margin: 0; padding: .5rem 1rem; font-size: var(--step-small); }
  .preview-box { position: relative; width: 100%; aspect-ratio: 16 / 10; background: #12201f; }
  /* Side by side on a short screen (§9.1): the box is capped by the height below the header and toolbar, and the game
     letterboxes inside it. */
  @media (max-height: 499.98px) {
    @container playground (min-width: 700px) { .preview-box { max-height: calc(100svh - 5rem - 52px); } }
  }
  .preview-panel:fullscreen { display: flex; flex-direction: column; }
  .preview-panel:fullscreen .preview-box { flex: 1; aspect-ratio: auto; }
  .poster { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; padding: 1.5rem; text-align: center; font-size: var(--step-body); }
  .poster p { max-width: 28ch; }
  .frames { position: absolute; inset: 0; }
  .frames :global(iframe) { position: absolute; inset: 0; display: block; width: 100%; height: 100%; border: 0; z-index: 0; }
  .frames :global(iframe.shown) { z-index: 1; }
  .stopped { position: absolute; left: .75rem; right: .75rem; bottom: .75rem; z-index: 3; margin: 0; padding: .6rem .9rem; border-radius: var(--radius-sm); background: rgb(17 21 28 / .85); overflow-wrap: anywhere; }
  .play { position: absolute; left: 50%; top: 50%; z-index: 4; transform: translate(-50%, -50%); min-height: 48px; padding: .6rem 1.6rem; border: 0; border-radius: var(--pill); background: var(--lime); color: var(--charcoal); font-weight: 600; }
  .preview-panel :focus-visible { outline-color: var(--lime); outline-offset: 2px; }
</style>
