// A playground frame's script. It runs the reader's compiled example, once, and
// tells the parent what happened. No-eval comes first, so nothing in the runtime reaches for eval under the policy.
import '@mcthaydt/automata/no-eval'
import type { DefinedGame } from '@mcthaydt/automata'
import { isDefinedGame } from '@mcthaydt/automata/tooling'
import type { HostSettings } from '@mcthaydt/examples-runner/header'
import {
  type FrameMessage,
  frameMessage,
  LOOP_GUARD_MS,
  LOOP_GUARD_NAME,
  MAX_FAILURE_CHARS,
  PROTOCOL_VERSION,
  RUNNING_FRAME_WAIT_MS,
  type RunMessage,
} from '../../src/features/playground/protocol.ts'
import { createLoopGuard, LoopGuardError } from './loop-guard.ts'
import { checkGolden, exampleSim, hashRun, runExample } from './ruken/harness.ts'
import { createRunGate } from './run-gate.ts'
import { exampleLocation } from './stack-location.ts'

/** The framework commit the build was made from, set by the playground's Vite build. */
declare const __AF_FRAMEWORK_COMMIT__: string

type Phase = 'import' | 'boot' | 'run'

const examplePath = document.body.dataset.example ?? ''
const hostSettings: HostSettings | undefined =
  document.body.dataset.host === undefined
    ? undefined
    : (JSON.parse(document.body.dataset.host) as HostSettings)

/** Every message is checked against the protocol on the way out too, so the frame never sends what the parent drops. */
function post(message: FrameMessage): void {
  parent.postMessage(frameMessage.parse(message), location.origin)
}

// The loop guard's stretch ends when the event loop gets a turn: a message posted to this frame's own channel is
// delivered only then, and unlike animation frames it arrives in an off-screen frame too.
const stretchEnds: (() => void)[] = []
const channel = new MessageChannel()
channel.port1.onmessage = () => {
  for (const end of stretchEnds.splice(0)) end()
}
Object.defineProperty(globalThis, LOOP_GUARD_NAME, {
  value: createLoopGuard({
    now: () => performance.now(),
    onStretch: (end) => {
      stretchEnds.push(end)
      channel.port2.postMessage(0)
    },
    limitMs: LOOP_GUARD_MS,
  }),
})

/** What the reader's code threw: the deepest error in the chain (the runtime wraps it in a BootDefect or a fault). */
function rootCause(cause: unknown): unknown {
  let current = cause
  for (let depth = 0; depth < 8 && current instanceof Error && current.cause instanceof Error; depth += 1)
    current = current.cause
  return current
}

function failure(runId: number, phase: Phase, cause: unknown): FrameMessage {
  const error = rootCause(cause)
  const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_FAILURE_CHARS)
  const base = { v: PROTOCOL_VERSION, type: 'failed', runId, phase, message } as const
  if (error instanceof LoopGuardError)
    return error.line >= 1 ? { ...base, line: error.line, hung: true } : { ...base, hung: true }
  const location =
    error instanceof Error && error.stack ? exampleLocation(error.stack, examplePath) : undefined
  return location === undefined ? base : { ...base, ...location }
}

/** Resolves with the runtime's state once it says ready or failed (`data-state` on the root element). */
function settled(): Promise<'ready' | 'failed'> {
  const state = () => document.documentElement.getAttribute('data-state')
  return new Promise((resolve) => {
    const check = () => {
      const now = state()
      if (now !== 'ready' && now !== 'failed') return false
      observer.disconnect()
      resolve(now)
      return true
    }
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-state'] })
    check()
  })
}

/** The next animation frame, or RUNNING_FRAME_WAIT_MS when the browser gives an off-screen frame none. */
function nextFrameOrWait(): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, RUNNING_FRAME_WAIT_MS)
    requestAnimationFrame(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

async function determinism(game: DefinedGame<unknown>, run: RunMessage): Promise<void> {
  const request = run.determinism
  if (request === undefined) return
  if (request.replay === undefined) {
    const hash = await hashRun(game, request.ticks)
    post({
      v: PROTOCOL_VERSION,
      type: 'determinism',
      runId: run.runId,
      ticks: request.ticks,
      hash,
      golden: 'none',
    })
    return
  }
  const response = await fetch(request.replay)
  if (!response.ok) throw new Error(`the golden could not be read (${response.status})`)
  const checked = await checkGolden(game, new Uint8Array(await response.arrayBuffer()))
  post({ v: PROTOCOL_VERSION, type: 'determinism', runId: run.runId, ...checked })
}

/** Runs the check, keeping its own failures apart from the example's: they never reach `fail`. */
async function checkDeterminism(game: DefinedGame<unknown>, run: RunMessage): Promise<void> {
  try {
    await determinism(game, run)
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, MAX_FAILURE_CHARS)
    post({ v: PROTOCOL_VERSION, type: 'determinism-unavailable', runId: run.runId, message })
  }
}

async function start(run: RunMessage): Promise<void> {
  let phase: Phase = 'import'
  let reported = false
  const fail = (cause: unknown, at: Phase = phase) => {
    if (reported) return
    reported = true
    post(failure(run.runId, at, cause))
  }
  window.addEventListener('error', (event) => fail(event.error ?? event.message))
  window.addEventListener('unhandledrejection', (event) => fail(event.reason))

  let game: unknown
  try {
    const url = URL.createObjectURL(new Blob([run.code], { type: 'text/javascript' }))
    game = ((await import(/* @vite-ignore */ url)) as { default?: unknown }).default
  } catch (error) {
    fail(error)
    return
  }
  if (!isDefinedGame(game as never)) {
    fail(new Error("This code doesn't make a game any more. Press Reset to start again"))
    return
  }
  const defined = game as DefinedGame<unknown>

  phase = 'boot'
  // The sim is set up once headless before the runtime starts it, so a throw in `setup` or a plugin reaches the
  // frame with its stack; inside the runtime it would show only as a panel.
  try {
    ;(await exampleSim(defined)).dispose()
  } catch (error) {
    fail(error)
    return
  }
  const root = document.getElementById('game')
  if (root === null) throw new Error('the frame page has no #game')
  try {
    runExample(defined, { root, host: hostSettings, onFailure: (cause) => fail(cause) })
  } catch (error) {
    fail(error)
    return
  }
  if ((await settled()) === 'failed') {
    fail(new Error('The example failed to start.'))
    return
  }
  phase = 'run'
  await nextFrameOrWait()
  if (reported) return
  post({ v: PROTOCOL_VERSION, type: 'running', runId: run.runId })
  await new Promise((resolve) => setTimeout(resolve, 0))
  await checkDeterminism(defined, run)
}

const gate = createRunGate(window.parent, location.origin)
window.addEventListener('message', (event) => {
  const run = gate(event)
  if (run !== undefined) void start(run)
})
post({ v: PROTOCOL_VERSION, type: 'booted', framework: __AF_FRAMEWORK_COMMIT__ })
