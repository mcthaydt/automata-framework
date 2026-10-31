// A fake Web Audio context that records the graph a synth builds (M6.10a): which nodes, how they connect and what each
// param was told. Node has no Web Audio, so the synth's tests read this instead of listening.

export interface FakeParam {
  value: number
  readonly calls: string[]
  setValueAtTime(v: number, t: number): void
  exponentialRampToValueAtTime(v: number, t: number): void
  linearRampToValueAtTime(v: number, t: number): void
  cancelScheduledValues(t: number): void
  setTargetAtTime(v: number, t: number, c: number): void
}
export interface FakeNode {
  readonly kind: string
  readonly id: number
  readonly params: Record<string, FakeParam>
  readonly connections: FakeNode[]
  readonly calls: string[]
  props: Record<string, unknown>
  connect(to: FakeNode): FakeNode
}
export interface FakeContext {
  readonly nodes: FakeNode[]
  currentTime: number
  readonly sampleRate: number
  readonly destination: FakeNode
}

const param = (initial = 1): FakeParam => {
  const calls: string[] = []
  return {
    value: initial,
    calls,
    setValueAtTime(v, t) {
      calls.push(`set ${v} @${round(t)}`)
    },
    exponentialRampToValueAtTime(v, t) {
      calls.push(`exp ${v} @${round(t)}`)
    },
    linearRampToValueAtTime(v, t) {
      calls.push(`lin ${v} @${round(t)}`)
    },
    cancelScheduledValues(t) {
      calls.push(`cancel @${round(t)}`)
    },
    setTargetAtTime(v, t, c) {
      calls.push(`target ${round(v)} @${round(t)} c${round(c)}`)
    },
  }
}
const round = (n: number): number => Math.round(n * 1e6) / 1e6

const PARAMS: Record<string, string[]> = {
  gain: ['gain'],
  oscillator: ['frequency'],
  biquad: ['frequency', 'Q'],
  panner: ['pan'],
  buffer: [],
  destination: [],
}

/** A context whose `create*` methods give recording nodes. */
export function fakeContext(sampleRate = 8000): FakeContext & Record<string, unknown> {
  const nodes: FakeNode[] = []
  const make = (kind: string): FakeNode => {
    const calls: string[] = []
    const node: FakeNode = {
      kind,
      id: nodes.length,
      params: Object.fromEntries((PARAMS[kind] ?? []).map((p) => [p, param(p === 'frequency' ? 440 : 1)])),
      connections: [],
      calls,
      props: {},
      connect(to) {
        node.connections.push(to)
        return to
      },
    }
    Object.assign(node, node.params, {
      start: (t?: number) => calls.push(`start ${round(t ?? 0)}`),
      stop: (t?: number) => calls.push(`stop ${round(t ?? 0)}`),
    })
    nodes.push(node)
    return node
  }
  const ctx = {
    nodes,
    currentTime: 0,
    sampleRate,
    destination: make('destination'),
    createGain: () => make('gain'),
    createOscillator: () => make('oscillator'),
    createBiquadFilter: () => make('biquad'),
    createStereoPanner: () => make('panner'),
    createBufferSource: () => make('buffer'),
    createBuffer: (_channels: number, length: number, rate: number) => ({
      length,
      sampleRate: rate,
      data: new Float32Array(length),
      getChannelData() {
        return this.data
      },
    }),
  }
  return ctx
}
