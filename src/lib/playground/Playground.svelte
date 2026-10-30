<script lang="ts" module>
  // Under reduced motion an example waits for Play; once the reader has pressed it on this visit, the next example
  // they open starts on its own (spec F10).
  let playedThisVisit = false
</script>
<script lang="ts">
  import { onMount } from 'svelte'
  import type { Example } from '../../data/examples'
  import { SITE_ORIGIN } from '$lib/site.js'
  import CodePanel from './CodePanel.svelte'
  import PreviewPanel from './PreviewPanel.svelte'
  import type { Orchestrator, OrchestratorView, PreviewFrame } from './orchestrator'
  import { STATUS } from './status'
  import { atOrigin } from './origin'
  import type { HighlightedLine } from './highlight'
  import type { CodeState } from './CodePanel.svelte'

  let { example, highlighted }: { example: Example; highlighted: HighlightedLine[] } = $props()
  const REDUCED = 'Press Play to start the example. Once it runs, edits update it live.'
  const uid = $props.id()
  const statusId = 'playground-status-' + uid

  let view = $state<OrchestratorView>({ preview: 'poster', runId: 0, status: '', stopped: null, frames: 0 })
  let waitingForPlay = $state(false)
  let fetchFailed = $state(false)
  let code = $state<CodeState>('static')
  let stage: HTMLElement | undefined = $state()
  let box: HTMLElement | undefined = $state()
  let orchestrator: Orchestrator | undefined
  let started = false
  let disposed = false

  let previewStatus = $derived(fetchFailed ? STATUS.firstBootTimeout : waitingForPlay && view.preview === 'poster' ? REDUCED : view.status)
  let status = $derived(code === 'loading' ? STATUS.loadingEditor : code === 'failed' ? STATUS.editorFailed : previewStatus)
  let showPlay = $derived(waitingForPlay && view.preview === 'poster' || (view.preview === 'failed' && view.frames === 0) || fetchFailed)

  /** A sandboxed frame on the example's frame page, under the one on show until it reports `running` (spec F4). */
  function createFrame(): PreviewFrame {
    const frame = document.createElement('iframe')
    frame.setAttribute('sandbox', 'allow-scripts')
    // `*`: the frame's origin is opaque, and WebKit matches a bare feature to the src's origin, which it is not.
    frame.setAttribute('allow', 'fullscreen *; autoplay *; gamepad *')
    frame.setAttribute('referrerpolicy', 'no-referrer')
    frame.setAttribute('inert', '')
    frame.setAttribute('aria-hidden', 'true')
    frame.src = example.framePage
    stage!.append(frame)
    return {
      window: frame.contentWindow,
      post: message => frame.contentWindow?.postMessage(message, '*'),
      reveal() {
        frame.removeAttribute('inert')
        frame.removeAttribute('aria-hidden')
        frame.title = 'Preview: ' + example.title
        frame.classList.add('shown')
      },
      remove: () => frame.remove(),
    }
  }

  /** The original, precompiled at sync time, so the first run needs neither the editor nor the compiler (spec F1). */
  async function runOriginal() {
    fetchFailed = false
    try {
      // The orchestrator and the protocol's schemas load with the first run, not with the page (the preload budget).
      orchestrator ??= await loadOrchestrator()
      const response = await fetch('/playground/compiled/' + example.id + '.js')
      if (!response.ok) throw new Error(String(response.status))
      orchestrator.run(atOrigin(await response.text(), SITE_ORIGIN, location.origin))
    } catch {
      fetchFailed = true
    }
  }

  function start() {
    if (started) return
    started = true
    void runOriginal()
  }

  function play() {
    playedThisVisit = true
    waitingForPlay = false
    started = true
    // After a failed run Play tries the same code again; otherwise it fetches the original.
    if (view.preview === 'failed' && !fetchFailed) orchestrator?.restart()
    else void runOriginal()
  }

  async function loadOrchestrator(): Promise<Orchestrator> {
    const { createOrchestrator } = await import('./orchestrator')
    if (disposed) throw new Error('the page has gone')
    return createOrchestrator({
      createFrame,
      clock: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: handle => clearTimeout(handle as number) },
      title: example.title,
      onChange: next => { view = next },
    })
  }

  onMount(() => {
    const onMessage = (event: MessageEvent) => orchestrator?.receive({ source: event.source, origin: event.origin, data: event.data })
    window.addEventListener('message', onMessage)
    // Chromium lets a frame's own script take focus while the frame is still `inert`, so the arrival run took the
    // caret from a reader already in the code. Only the page's `blur` shows it: focus goes back where it was (§9.2).
    let lastFocus: Element | null = null
    const onFocusIn = (event: FocusEvent) => { lastFocus = event.target as Element }
    const onBlur = () => {
      const active = document.activeElement
      if (!(active instanceof HTMLIFrameElement && active.hasAttribute('inert') && stage?.contains(active))) return
      if (lastFocus instanceof HTMLElement && lastFocus.isConnected) lastFocus.focus({ preventScroll: true })
      else active.blur()
    }
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('blur', onBlur)
    let observer: IntersectionObserver | undefined
    const onLoad = () => {
      // The frame starts once the page's own downloads are done and the preview is within a screen of view (R-9).
      if (typeof IntersectionObserver === 'undefined') return start()
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer?.disconnect(); start() }
      }, { rootMargin: '100% 0px' })
      observer.observe(box!)
    }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !playedThisVisit) waitingForPlay = true
    else if (document.readyState === 'complete') onLoad()
    else window.addEventListener('load', onLoad, { once: true })
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('load', onLoad)
      observer?.disconnect()
      disposed = true
      orchestrator?.dispose()
    }
  })
</script>
<div class="playground" data-code={code} data-preview={view.preview} data-run-id={view.runId}>
  <div class="playground-grid">
  <div class="playground-code"><CodePanel source={example.source} {highlighted} title={example.title} describedBy={statusId} oncodestate={next => { code = next }} /></div>
  <div class="playground-preview" bind:this={box}>
    <PreviewPanel title={example.title} {view} {showPlay} onplay={play} onrestart={() => orchestrator?.restart()} bind:stage />
    <p class="playground-status" id={statusId}>{status}</p>
  </div>
  </div>
</div>
<style>
  .playground { container: playground / inline-size; margin-top: 2rem; }
  .playground-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; }
  .playground-code { min-width: 0; }
  .playground-preview { order: -1; min-width: 0; }
  .playground-status { margin: .75rem 0 0; min-height: 1.5em; font-size: var(--step-small); color: var(--muted); overflow-wrap: anywhere; }
  @container playground (min-width: 700px) {
    .playground-grid { grid-template-columns: minmax(0, 55fr) minmax(0, 45fr); align-items: start; }
    .playground-preview { order: 0; position: sticky; top: 5rem; }
  }
</style>
