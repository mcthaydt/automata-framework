<script lang="ts" module>
  // Under reduced motion an example waits for Play; once the reader has pressed it on this visit, the next example
  // they open starts on its own (spec F10).
  let playedThisVisit = false
</script>
<script lang="ts">
  import { onMount } from 'svelte'
  import { replaceState } from '$app/navigation'
  import { page } from '$app/state'
  import type { Example } from '../../data/examples'
  import { SITE_ORIGIN } from '$lib/site.js'
  import CodePanel from './CodePanel.svelte'
  import PreviewPanel from './PreviewPanel.svelte'
  import DeterminismRow from './DeterminismRow.svelte'
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
  let playground: HTMLElement | undefined = $state()
  /** The Preview toggle's state (§9.1): it hides the preview only while the playground is one column. */
  let previewShown = $state(true)
  /** One column: the playground is narrower than 700 px. */
  let narrow = $state(false)
  const previewHidden = $derived(narrow && !previewShown)
  let orchestrator: Orchestrator | undefined
  let orchestratorLoad: Promise<Orchestrator> | undefined
  /** §7.1's Compile state. */
  let compile = $state<'original' | 'compiling' | 'ok' | 'syntax-error'>('original')
  let diagnostics = $state<readonly Diagnostic[]>([])
  let live: LiveCompile | undefined
  /** The compile worker failed to start or crashed: edits stop compiling, and Play still runs the original (§7.2). */
  let liveFailed = $state(false)
  /** The code differs from the original (Reset is shown, F7). */
  let edited = $state(false)
  /** The page's address, which carries the last good edit (F8). */
  let link = $state('')
  /** A share link is being decoded, or its code runs: the original waits (F9). */
  let sharedRun = false
  /** The original was asked to start while a share link was being decoded. */
  let startWanted = false
  /** The share link could not be read; shown until the next edit (F9). */
  let linkUnreadable = $state(false)
  /** Edits that compile now, without the quiet period, once the worker is up (Reset, a share link). */
  let pendingNow = false
  let fragmentWrites = 0
  /** An edit made while the worker is still loading, compiled once it is up. */
  let pendingEdit: string | undefined
  /** The last edit that compiled, which Play runs under reduced motion. */
  let compiled: string | undefined
  /** Counts runs asked for, so an original still downloading is not run after an edit that compiled first (F4). */
  let runs = 0
  let started = false
  let disposed = false

  let previewStatus = $derived(fetchFailed ? STATUS.offline : waitingForPlay && view.preview === 'poster' ? REDUCED : view.status)
  /** The editor marks the compile's diagnostics and the line of the last frame failure (§7.2). */
  let marked = $derived(view.failure ? [...diagnostics, view.failure] : diagnostics)
  let diagnosticStatus = $derived(diagnostics[0] ? diagnosticText(diagnostics[0], view.preview === 'running') : undefined)
  /** The polite live region's text: a diagnostic, once it has stood for ANNOUNCE_AFTER_MS (spec F5). */
  let announced = $state('')
  $effect(() => {
    const text = diagnosticStatus
    if (text === undefined) { announced = ''; return }
    const timer = setTimeout(() => { announced = text }, ANNOUNCE_AFTER_MS)
    return () => clearTimeout(timer)
  })
  /** The runtime or the compiled original didn't download: Retry, not Play (§7.2, §8.2). */
  let showRetry = $derived(fetchFailed || (view.preview === 'failed' && view.frames === 0 && view.status === STATUS.offline))
  let status = $derived(code === 'loading' ? STATUS.loadingEditor : code === 'failed' ? STATUS.editorFailed : liveFailed && !showRetry ? STATUS.liveUnavailable : linkUnreadable ? STATUS.linkUnreadable : diagnosticStatus ?? previewStatus)
  let showPlay = $derived(!showRetry && (waitingForPlay && view.preview === 'poster' || (view.preview === 'failed' && view.frames === 0)))

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

  /** F6: an example with a golden asks for the check; only the unedited original replays the golden, an edit is hashed. */
  function determinismRequest(isEdit: boolean) {
    const golden = example.golden
    if (golden === undefined) return undefined
    return isEdit ? { ticks: golden.ticks } : { ticks: golden.ticks, replay: golden.replay }
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
      if (run === runs) orchestrator.run(code, determinismRequest(false))
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
      if (run === runs) orchestrator.run(code, determinismRequest(edited))
    } catch {
      // The page has gone.
    }
  }

  function onResult({ source, result }: LiveResult) {
    if (!result.ok) {
      compile = 'syntax-error'
      diagnostics = result.diagnostics
      return
    }
    compile = 'ok'
    diagnostics = []
    void writeFragment(source)
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
    worker.onerror = () => {
      liveFailed = true
      live?.dispose()
      // An edit it was compiling is dropped; the preview runs what it ran.
      if (compile === 'compiling') compile = compiled === undefined ? 'original' : 'ok'
      // A share link's code can't compile now, so the original runs in its place, as the status line says.
      if (sharedRun && !orchestratorLoad) {
        sharedRun = false
        if (startWanted) start()
      }
    }
    if (pendingEdit !== undefined) {
      if (pendingNow) live.now(pendingEdit)
      else live.edit(pendingEdit)
    }
    pendingEdit = undefined
    pendingNow = false
  }

  function onedit(source: string, now = false) {
    edited = source !== example.source
    linkUnreadable = false
    if (liveFailed) return
    compile = 'compiling'
    if (live) {
      if (now) live.now(source)
      else live.edit(source)
    } else {
      pendingEdit = source
      pendingNow = now
    }
  }

  /** The fragment carries the code that last compiled, and none for the original (F8). Shallow: no navigation. */
  async function writeFragment(source: string) {
    const write = ++fragmentWrites
    const url = new URL(location.href)
    url.hash = source === example.source ? '' : await import('./share').then(share => share.encodeShare(source))
    if (write !== fragmentWrites || disposed) return
    if (url.href !== location.href) replaceState(url.hash ? url : url.pathname + url.search, page.state)
    link = location.href
  }

  /** The original back in the editor, undoably, compiled at once and the fragment gone (F7). */
  function reset() {
    codePanel?.reset()
    onedit(example.source, true)
    void writeFragment(example.source)
  }

  /** A `#code=` link, decoded after hydration: its code goes into the editor and through the worker (F9). */
  async function openLink() {
    sharedRun = true
    let shared: string | undefined
    try {
      const { decodeShare } = await import('./share')
      shared = await decodeShare(location.hash)
    } catch {
      linkUnreadable = true
    }
    if (disposed) return
    if (shared === undefined) {
      sharedRun = false
      if (startWanted) start()
      return
    }
    // The original's precompiled module is not run: the shared code is (PLAY-D1), once compiled.
    await codePanel?.open(shared)
    onedit(shared, true)
  }

  function oncodestate(next: CodeState) {
    code = next
    if (next === 'loading') void startLive()
  }

  function start() {
    if (started) return
    if (sharedRun) {
      startWanted = true
      return
    }
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

  /** A fresh first frame for the code in the editor: the reader's last good edit, or the original. */
  function retry() {
    if (compiled !== undefined) void runCompiled(compiled)
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
    link = location.href
    if (location.hash.startsWith('#code=')) void openLink()
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
    // The toggle hides the preview only in one column: widened, the preview shows and takes input again.
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(([entry]) => { narrow = entry!.contentRect.width < 700 })
    resize?.observe(playground!)
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
      resize?.disconnect()
      disposed = true
      orchestrator?.dispose()
      live?.dispose()
    }
  })
</script>
<div class="playground" bind:this={playground} data-code={code} data-compile={compile} data-preview={view.preview} data-run-id={view.runId}>
  <div class="playground-grid">
  <div class="playground-code"><CodePanel source={example.source} {highlighted} title={example.title} describedBy={statusId} {oncodestate} onedit={text => onedit(text)} diagnostics={marked} {link} {edited} onreset={reset} {previewShown} ontogglepreview={() => { previewShown = !previewShown }} bind:this={codePanel} /></div>
  <div class="playground-preview" data-shown={!previewHidden} inert={previewHidden} bind:this={box}>
    <PreviewPanel title={example.title} {view} {showPlay} onplay={play} {showRetry} onretry={retry} onrestart={() => orchestrator?.restart()} bind:stage />
    <p class="playground-status" id={statusId}>{#if diagnosticStatus && status === diagnosticStatus}<button type="button" class="diagnostic" onclick={() => codePanel?.focusAt(diagnostics[0]!.line, diagnostics[0]!.column)}>{status}</button>{:else}{status}{/if}</p>
    {#if view.determinism}<DeterminismRow view={view.determinism} exampleId={example.id} />{/if}
    <p class="playground-announce sr-only" aria-live="polite">{announced}</p>
  </div>
  </div>
</div>
<style>
  .playground { container: playground / inline-size; margin-top: 2rem; }
  .playground-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.25rem; }
  .playground-code { min-width: 0; }
  .playground-preview { order: -1; min-width: 0; }
  /* Hidden, the wrapper clips to nothing while the frame keeps its own box, so the game is neither resized nor reloaded. */
  .playground-preview[data-shown='false'] { height: 0; overflow: clip; }
  .playground-status { margin: .75rem 0 0; min-height: 1.5em; font-size: var(--step-small); color: var(--muted); overflow-wrap: anywhere; }
  /* The diagnostic reads as the status line it is, and is a 44 px target that takes the reader to the line (§8.2). */
  .diagnostic { display: block; width: 100%; min-height: 44px; padding: .5rem 0; border: 0; background: none; font: inherit; color: var(--ink); text-align: left; text-decoration: underline; text-underline-offset: .2em; cursor: pointer; }
  @container playground (min-width: 700px) {
    .playground-grid { grid-template-columns: minmax(0, 55fr) minmax(0, 45fr); align-items: start; }
    .playground-preview { order: 0; position: sticky; top: 5rem; }
  }
</style>
