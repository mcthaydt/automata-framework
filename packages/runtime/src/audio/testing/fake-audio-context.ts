// A recording stand-in for the Web Audio graph, from FloorFifty `tests/client/managers/audio.test.ts` `fakeContext`
// at `ac72660`. It has no audio rate: automation lands where it ends, at once, and records what was asked, so a test
// reads levels from `value` and ramps from `automation`. `advance` moves the clock and ends the sources whose stop
// time it passes.
import type { AudioContextLike } from '../audio-graph.js'

export interface FakeGainNode {
  readonly targets: unknown[]
  readonly automation: Array<{ readonly method: string; readonly value?: number; readonly at: number }>
  readonly gain: { value: number }
}

export interface Started {
  readonly alias: string
  readonly loop: boolean
  readonly loopStart: number
  readonly loopEnd: number
  readonly offset?: number
  readonly rate?: number
  readonly target: unknown
}

export interface FakeAudioContext extends AudioContextLike {
  state: AudioContextLike['state']
  currentTime: number
  readonly gains: FakeGainNode[]
  readonly started: Started[]
  readonly stopped: Array<{ readonly alias: string; readonly when: number }>
  readonly resumed: number
  readonly closed: boolean
  /** Moves the clock on, ending every source whose stop time it passes. */
  advance(seconds: number): void
  /** As the system does for a phone call or Siri. */
  interrupt(): void
  /** Ends a source as if it played out. */
  end(alias: string): void
}

/** A decoded buffer that remembers the alias it came from, so `started` can name it. */
export const fakeBuffer = (alias: string, duration = 1): AudioBuffer =>
  ({ alias, duration }) as unknown as AudioBuffer

/**
 * `decode` turns the bytes `decodeAudioData` receives into a buffer, or throws as the browser does for bytes that
 * are not audio; by default the bytes are the alias's UTF-8 text.
 */
export function fakeAudioContext(
  decode: (bytes: ArrayBuffer) => AudioBuffer = (bytes) => fakeBuffer(new TextDecoder().decode(bytes)),
): FakeAudioContext {
  const gains: FakeGainNode[] = []
  const started: Started[] = []
  const stopped: Array<{ alias: string; when: number }> = []
  const stopping: Array<{ at: number; end: () => void }> = []
  const playing: Array<{ alias: string; end: () => void }> = []
  let resumed = 0
  let closed = false

  const context = {
    state: 'suspended' as AudioContextLike['state'],
    currentTime: 0,
    destination: { destination: true } as unknown as AudioDestinationNode,
    gains,
    started,
    stopped,
    get resumed() {
      return resumed
    },
    get closed() {
      return closed
    },
    async resume() {
      resumed += 1
      context.state = 'running'
    },
    async suspend() {
      context.state = 'suspended'
    },
    async close() {
      closed = true
      context.state = 'closed'
    },
    interrupt() {
      context.state = 'interrupted'
    },
    advance(seconds: number) {
      context.currentTime += seconds
      for (const due of stopping.filter((entry) => entry.at <= context.currentTime)) {
        stopping.splice(stopping.indexOf(due), 1)
        due.end()
      }
    },
    end(alias: string) {
      playing.find((source) => source.alias === alias)?.end()
    },
    async decodeAudioData(bytes: ArrayBuffer) {
      return decode(bytes)
    },
    createGain() {
      let value = 1
      const automation: FakeGainNode['automation'] = []
      const set = (method: string) => (next: number, at: number) => {
        automation.push({ method, value: next, at })
        value = next
      }
      const node = {
        targets: [] as unknown[],
        automation,
        gain: {
          get value() {
            return value
          },
          set value(next: number) {
            value = next
          },
          setTargetAtTime: set('setTargetAtTime'),
          setValueAtTime: set('setValueAtTime'),
          linearRampToValueAtTime: set('linearRampToValueAtTime'),
          cancelScheduledValues: (at: number) => automation.push({ method: 'cancelScheduledValues', at }),
        },
        connect(target: unknown) {
          node.targets.push(target)
          return target
        },
        disconnect() {
          node.targets.length = 0
        },
      }
      gains.push(node)
      return node as unknown as GainNode
    },
    createBufferSource() {
      let target: unknown
      const alias = () => (node.buffer as unknown as { alias?: string } | null)?.alias ?? '?'
      const finish = () => {
        const index = playing.findIndex((source) => source.end === finish)
        if (index >= 0) playing.splice(index, 1)
        node.onended?.()
      }
      const node = {
        buffer: null as AudioBuffer | null,
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        playbackRate: { value: 1 },
        onended: null as (() => void) | null,
        connect(next: unknown) {
          target = next
          return next
        },
        disconnect() {
          target = undefined
        },
        start(_when?: number, offset?: number) {
          started.push({
            alias: alias(),
            loop: node.loop,
            loopStart: node.loopStart,
            loopEnd: node.loopEnd,
            ...(offset === undefined ? {} : { offset }),
            ...(node.playbackRate.value === 1 ? {} : { rate: node.playbackRate.value }),
            target,
          })
          playing.push({ alias: alias(), end: finish })
        },
        stop(when?: number) {
          stopped.push({ alias: alias(), when: when ?? context.currentTime })
          if (when === undefined || when <= context.currentTime) finish()
          else stopping.push({ at: when, end: finish })
        },
      }
      return node as unknown as AudioBufferSourceNode
    },
  }
  return context as unknown as FakeAudioContext
}
