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
  import { ANNOUNCE_AFTER_MS, diagnosticText, STATUS } from './status'
  import type { Diagnostic } from './compile'
  import type { LiveCompile, LiveResult } from './live'
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
  let codePanel: ReturnType<typeof CodePanel> | undefined = $state()
  let box: HTMLElement | undefined = $state()
  let orchestrator: Orchestrator | undefined
  let orchestratorLoad: Promise<Orchestrator> | undefined
  /** §7.1's Compile state. */
  let compile = $state<'original' | 'compiling' | 'ok' | 'syntax-error'>('original')
  let diagnostics = $state<readonly Diagnostic[]>([])
  let live: LiveCompile | undefined
  /** An edit made while the worker is still loading, compiled once it is up. */
  let pendingEdit: string | undefined
  /** The last edit that compiled, which Play runs under reduced motion. */
  let compiled: string | undefined
  /** Counts runs asked for, so an original still downloading is not run after an edit that compiled first (F4). */
  let runs = 0
  let started = false
  let disposed = false

  let previewStatus = $derived(fetchFailed ? STATUS.firstBootTimeout : waitingForPlay && view.preview === 'poster' ? REDUCED : view.status)
  let diagnosticStatus = $derived(diagnostics[0] ? diagnosticText(diagnostics[0], view.preview === 'running') : undefined)
  /** The polite live region's text: a diagnostic, once it has stood for ANNOUNCE_AFTER_MS (spec F5). */
  let announced = $state('')
  $effect(() => {
    const text = diagnosticStatus
    if (text === undefined) { announced = ''; return }
    const timer = setTimeout(() => { announced = text }, ANNOUNCE_AFTER_MS)
    return () => clearTimeout(timer)
  })
  let status = $derived(code === 'loading' ? STATUS.loadingEditor : code === 'failed' ? STATUS.editorFailed : diagnosticStatus ?? previewStatus)
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
    const run = ++runs
    try {
      // The orchestrator and the protocol's schemas load with the first run, not with the page (the preload budget).
      const orchestrator = await getOrchestrator()
      const response = await fetch('/playground/compiled/' + example.id + '.js')
      if (!response.ok) throw new Error(String(response.status))
      const code = atOrigin(await response.text(), SITE_ORIGIN, location.origin)
      if (run === runs) orchestrator.run(code)
    } catch {
      if (run === runs) fetchFailed = true
    }
  }

  /** Code the worker compiled from the reader's edit; it replaces whatever runs or is starting (F4). */
  async function runCompiled(code: string) {
    started = true
    fetchFailed = false
    const run = ++runs
    try {
      const orchestrator = await getOrchestrator()
      if (run === runs) orchestrator.run(code)
    } catch {
      // The page has gone.
    }
  }

  function onResult({ result }: LiveResult) {
    if (!result.ok) {
      compile = 'syntax-error'
      diagnostics = result.diagnostics
      return
    }
    compile = 'ok'
    diagnostics = []
    compiled = result.code
    // Under reduced motion nothing runs until Play, an edit included (§7.4).
    if (!waitingForPlay) void runCompiled(result.code)
  }

  /** The compile worker starts with the editor (F2), so the first edit is not kept waiting for it. */
  async function startLive() {
    if (live) return
    const { createLiveCompile } = await import('./live')
    if (disposed || live) return
    const worker = new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' })
    const target = { id: example.id, moduleUrl: new URL(example.moduleUrl, location.origin).href }
    live = createLiveCompile({
      clock,
      worker: { post: job => worker.postMessage({ ...job, example: target }), terminate: () => worker.terminate() },
      onResult,
    })
    worker.onmessage = event => live?.receive(event.data)
    if (pendingEdit !== undefined) live.edit(pendingEdit)
    pendingEdit = undefined
  }

  function onedit(source: string) {
    compile = 'compiling'
    if (live) live.edit(source)
    else pendingEdit = source
  }

  function oncodestate(next: CodeState) {
    code = next
    if (next === 'loading') void startLive()
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
    // After a failed run Play tries the same code again; otherwise it runs the reader's last good edit, or the original.
    if (view.preview === 'failed' && !fetchFailed) orchestrator?.restart()
    else if (compiled !== undefined) void runCompiled(compiled)
    else void runOriginal()
  }

  const clock = { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms), clearTimeout: (handle: unknown) => clearTimeout(handle as number) }

  /** One orchestrator per page, however many runs ask for it while it loads. */
  function getOrchestrator(): Promise<Orchestrator> {
    orchestratorLoad ??= import('./orchestrator').then(({ createOrchestrator }) => {
      if (disposed) throw new Error('the page has gone')
      orchestrator = createOrchestrator({ createFrame, clock, title: example.title, onChange: next => { view = next } })
      return orchestrator
    })
    return orchestratorLoad
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
      live?.dispose()
    }
  })
</script>
<div class="playground" data-code={code} data-compile={compile} data-preview={view.preview} data-run-id={view.runId}>
  <div class="playground-grid">
  <div class="playground-code"><CodePanel source={example.source} {highlighted} title={example.title} describedBy={statusId} {oncodestate} {onedit} {diagnostics} bind:this={codePanel} /></div>
  <div class="playground-preview" bind:this={box}>
    <PreviewPanel title={example.title} {view} {showPlay} onplay={play} onrestart={() => orchestrator?.restart()} bind:stage />
    <p class="playground-status" id={statusId}>{#if diagnosticStatus && status === diagnosticStatus}<button type="button" class="diagnostic" onclick={() => codePanel?.focusAt(diagnostics[0]!.line, diagnostics[0]!.column)}>{status}</button>{:else}{status}{/if}</p>
    <p class="playground-announce sr-only" aria-live="polite">{announced}</p>
  </div>
  </div>
</div>
<style>
  .playground { container: playground / inline-size; margin-top: 2rem; }
  .playground-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; }
  .playground-code { min-width: 0; }
  .playground-preview { order: -1; min-width: 0; }
  .playground-status { margin: .75rem 0 0; min-height: 1.5em; font-size: var(--step-small); color: var(--muted); overflow-wrap: anywhere; }
  /* The diagnostic reads as the status line it is, and is a 44 px target that takes the reader to the line (§8.2). */
  .diagnostic { display: block; width: 100%; min-height: 44px; padding: .5rem 0; border: 0; background: none; font: inherit; color: var(--ink); text-align: left; text-decoration: underline; text-underline-offset: .2em; cursor: pointer; }
  @container playground (min-width: 700px) {
    .playground-grid { grid-template-columns: minmax(0, 55fr) minmax(0, 45fr); align-items: start; }
    .playground-preview { order: 0; position: sticky; top: 5rem; }
  }
</style>
