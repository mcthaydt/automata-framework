<script lang="ts">
// A 3D example on its page: a stage with one Play button, and nothing of the 3D build is fetched until it is pressed, so
// a phone on a slow line pays for 3D only when asked. Pressed, the example's own page (built by `buildScenes` in
// scripts/build-demos.ts) loads in a frame at its play screen (`?play`: the visitor has pressed Play once already), the keys go to it, and Escape (read inside the frame, which the page cannot
// see otherwise) hands them back to Stop, so a keyboard visitor is never held by the canvas. Under the stage is one line
// of what to press (the header's `Controls`), then the code, read-only: unlike the 2D pages, a 3D page does not compile
// the code in the browser (the runtime holds no 3D).
import { onMount } from 'svelte'
import CopyButton from '../../shared/components/CopyButton.svelte'
import { difficultyStars, type SceneExample } from '../../shared/framework/example-catalog'

/** One line of the highlighted code: the pieces `highlightLines` (the playground's, run at prerender) cuts it into. */
type HighlightedLine = { readonly text: string; readonly className: string }[]

let { example, highlighted }: { example: SceneExample; highlighted: HighlightedLine[] } = $props()
let playing = $state(false)
let loaded = $state(false)
let iframe: HTMLIFrameElement | undefined = $state()
let play: HTMLButtonElement | undefined = $state()
let stop: HTMLButtonElement | undefined = $state()
let stage: HTMLDivElement | undefined = $state()
/** Escape handed the keys to Stop; the frame may not take them back until the visitor goes to it. */
let keptOut = false

// The page is prerendered, so Play is on screen before the script that answers it. The page's first-press script keeps
// a press made until then (`data-play-pressed`, shared/html/hydration.ts); this starts from it when it mounts, so the
// visitor presses once, and says it has mounted (`data-play-mounted`) so the script stops marking.
onMount(() => {
  if (document.documentElement.dataset.playPressed !== undefined) {
    delete document.documentElement.dataset.playPressed
    start()
  }
  document.documentElement.dataset.playMounted = ''
})

function start() {
  keptOut = false
  loaded = false
  playing = true
  // On a short screen the stage starts part way down: bring all of it into view for the game.
  stage?.scrollIntoView?.({ block: 'nearest' })
}

/** The frame is ready to take keys: it gets them, and Escape in it comes back here. */
function framed() {
  const frame = iframe?.contentWindow
  if (frame === null || frame === undefined) return
  loaded = true
  // Escape is the page's: read first (capture) and kept from the game, whose own Escape (its pause screen) would take
  // the focus straight back into the frame. The game's pause stays on its own buttons.
  frame.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopImmediatePropagation()
      keptOut = true
      stop?.focus()
    },
    { capture: true },
  )
  // The game pauses when its frame loses the keys (the host's lifecycle) and its pause screen focuses Resume, which
  // would pull them back into the frame. After Escape they stay on this page until the visitor goes back to the frame
  // themselves: a press inside it, or Tab from here.
  frame.addEventListener('pointerdown', () => (keptOut = false), { capture: true })
  // A press focuses the frame before its pointerdown arrives, so whether the visitor went back is read a task later.
  frame.addEventListener('focus', () =>
    setTimeout(() => {
      if (keptOut) stop?.focus()
    }),
  )
  // The visitor pressed a button in this page, so the keys would go to it: hand them to the example.
  frame.focus()
}

function leave() {
  playing = false
  // The frame is dropped, so a stopped example costs nothing; the button that starts it again is where the visitor is.
  queueMicrotask(() => play?.focus())
}
</script>
<svelte:window onkeydown={(event) => { if (event.key === 'Tab') keptOut = false }} />
<section class="scene-frame" aria-label={'Play ' + example.title}>
  <div class="stage" bind:this={stage} data-playing={playing ? '' : undefined}>
    {#if playing}
      <iframe bind:this={iframe} src={example.frameUrl + '?play'} title={example.title} allow="autoplay; fullscreen" onload={framed}></iframe>
      {#if !loaded}<p class="starting" role="status">Starting…</p>{/if}
    {:else}
      {#if example.still}<img class="still" src={example.still} alt="" />{/if}
      <div class="cover">
        {#if !example.still}<p>{example.title}</p>{/if}
        <button type="button" class="play" data-play bind:this={play} onclick={start}>Play</button>
      </div>
    {/if}
  </div>
  <div class="under">
    <p class="controls">{example.controls}</p>
    {#if playing}<button type="button" class="stop" bind:this={stop} onclick={leave}>Stop</button>{/if}
  </div>
  <dl class="facts">
    <div><dt>Difficulty</dt><dd aria-label={'Difficulty ' + example.difficulty + ' of 4'}>{difficultyStars(example.difficulty)}</dd></div>
    <div><dt>Packages</dt><dd>{example.packages.join(', ')}</dd></div>
  </dl>
  <section class="code" aria-label={'Code for ' + example.title}>
    <div class="code-header"><span>TypeScript, read-only</span><CopyButton text={example.source} /></div>
    <!-- Keyboard focus lets readers scroll the code with the arrow keys. -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <pre class="static-code" data-framework-copy tabindex="0"><code>{#each highlighted as line}<span class="line">{#each line as piece}{#if piece.className}<span class={piece.className}>{piece.text}</span>{:else}{piece.text}{/if}{/each}</span>{/each}</code></pre>
  </section>
</section>
<style>
  .scene-frame { display: grid; gap: 1rem; min-width: 0; }
  /* 16:9 and never taller than the screen leaves room for: the example letterboxes inside it. */
  .stage { position: relative; width: 100%; aspect-ratio: 16 / 9; max-height: calc(100svh - 6rem); border-radius: var(--edge-lg); overflow: hidden; background: #12201f; color: var(--stage-ink); }
  .stage iframe { position: absolute; inset: 0; display: block; width: 100%; height: 100%; border: 0; }
  .still { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  /* The title (when there is no still) and Play, one above the other: the button is never over the words. */
  .cover { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 1rem; text-align: center; }
  .cover p { margin: 0; max-width: 28ch; font-size: var(--step-body); }
  .starting { position: absolute; left: .75rem; right: .75rem; bottom: .75rem; z-index: 1; margin: 0; padding: .6rem .9rem; border-radius: var(--edge-sm); background: rgb(17 21 28 / .85); }
  /* The primary action: 48 px high, in the middle of the stage. */
  .play { position: relative; z-index: 2; min-height: 48px; min-width: 48px; padding: .6rem 1.6rem; border: 0; border-radius: var(--edge-sm); background: var(--lime); color: var(--charcoal); font-weight: 600; }
  /* A phone on its side: the stage starts under the title, so Play sits at its top, on the first screen. */
  @media (orientation: landscape) and (max-height: 500px) { .cover { justify-content: flex-start; } }
  .stage :focus-visible { outline: 2px solid var(--lime); outline-offset: 2px; }
  .under { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
  .controls { margin: 0; flex: 1 1 14rem; min-width: 0; overflow-wrap: anywhere; }
  .stop { min-height: 44px; min-width: 44px; padding: .4rem 1rem; }
  .facts { display: flex; flex-wrap: wrap; gap: .25rem 2rem; margin: 0; }
  .facts div { display: flex; gap: .75rem; }
  .facts dt { color: var(--muted); }
  .facts dd { margin: 0; }
  .code { min-width: 0; border: 1px solid var(--line-strong); border-radius: var(--edge-lg); background: var(--paper); overflow: hidden; }
  .code-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 .5rem 0 1rem; border-bottom: 1px solid var(--line); font-size: var(--step-small); color: var(--muted); }
  .code-header :global(button) { min-height: 44px; min-width: 44px; }
  .static-code { margin: 0; padding: 1rem 1rem 1rem calc(3ch + 2rem); font-size: 1rem; line-height: 1.5; white-space: break-spaces; overflow-wrap: anywhere; word-break: break-word; overflow: visible; counter-reset: line; }
  .static-code code { white-space: inherit; overflow-wrap: inherit; word-break: inherit; }
  .line { counter-increment: line; }
  .line::before { content: counter(line); display: inline-block; width: 3ch; margin-left: calc(-3ch - 1rem); margin-right: 1rem; text-align: right; color: var(--muted); user-select: none; }
  .static-code:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  .code :global(:is(.tok-keyword, .tok-operatorKeyword)) { color: var(--cobalt); }
  .code :global(:is(.tok-string, .tok-string2, .tok-number, .tok-bool, .tok-atom, .tok-literal)) { color: var(--teal); }
  .code :global(:is(.tok-comment, .tok-meta)) { color: var(--muted); }
  .code :global(:is(.tok-typeName, .tok-className, .tok-namespace)) { color: var(--cobalt-deep); }
</style>
