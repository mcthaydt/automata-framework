// The F1 seams (PRODUCT spec §2): what a paid extension plugs into, and user code can use too. Each must be
// an export of a public `exports` entry of its owning package; `seams.test.ts` checks the committed reports.
// A Plus package may import only these entries (the boundary test inside automata-plus, PRODUCT.1b).

export interface Seam {
  readonly seam: string
  readonly package: string
  readonly entryPoint: string
  readonly name: string
  /** Members the export's declaration must have (an interface's properties). */
  readonly members?: readonly string[]
}

const runtime = '@mcthaydt/automata-runtime'
const renderPixi = '@mcthaydt/automata-render-pixi'

export const SEAMS: readonly Seam[] = [
  { seam: 'input profiles', package: runtime, entryPoint: '.', name: 'inputProfileSchema' },
  {
    seam: 'input profiles',
    package: runtime,
    entryPoint: '.',
    name: 'InputProfile',
    members: ['id', 'bindings'],
  },
  { seam: 'input profiles', package: runtime, entryPoint: '.', name: 'actionsForKey' },
  { seam: 'input profiles', package: runtime, entryPoint: '.', name: 'actionsForPadButton' },
  {
    seam: 'NetworkPort',
    package: runtime,
    entryPoint: '.',
    name: 'NetworkPort',
    members: ['onRemoteCommand', 'sendCommand', 'publishSnapshot', 'onSnapshot'],
  },
  { seam: 'NetworkPort', package: runtime, entryPoint: '.', name: 'AuthoritativeSnapshot' },
  {
    seam: 'audio buses',
    package: runtime,
    entryPoint: '.',
    name: 'AudioBuses',
    members: ['input', 'gain', 'setGain'],
  },
  { seam: 'audio buses', package: runtime, entryPoint: '.', name: 'AUDIO_BUS_NAMES' },
  { seam: 'audio buses', package: runtime, entryPoint: '.', name: 'audioBusGainsSchema' },
  {
    seam: 'render layer and post-filter slot',
    package: renderPixi,
    entryPoint: '.',
    name: 'PixiStage',
    members: ['backdrop', 'world', 'ui', 'filters', 'postFilters'],
  },
  {
    seam: 'render layer and post-filter slot',
    package: renderPixi,
    entryPoint: '.',
    name: 'createPixiRenderer',
  },
  {
    seam: 'render layer and post-filter slot',
    package: renderPixi,
    entryPoint: '.',
    name: 'createPostFilterSlot',
  },
  { seam: 'render layer and post-filter slot', package: renderPixi, entryPoint: '.', name: 'filterPrograms' },
  {
    seam: 'settings schema',
    package: runtime,
    entryPoint: '.',
    name: 'SettingsDef',
    members: ['key', 'version', 'schema'],
  },
  { seam: 'settings schema', package: runtime, entryPoint: '.', name: 'settingsStore' },
  { seam: 'presentation-bus events', package: runtime, entryPoint: '.', name: 'PresentationBus' },
  { seam: 'presentation-bus events', package: runtime, entryPoint: '.', name: 'RuntimeFacts' },
  { seam: 'presentation-bus events', package: runtime, entryPoint: '.', name: 'typedBus' },
  {
    seam: 'host leaderboard call',
    package: '@mcthaydt/automata-host',
    entryPoint: '.',
    name: 'Hosting',
    members: ['leaderboards'],
  },
  {
    seam: 'host leaderboard call',
    package: '@mcthaydt/automata-host',
    entryPoint: '.',
    name: 'HostingLeaderboards',
    members: ['submit', 'get'],
  },
  { seam: 'defineExtension', package: runtime, entryPoint: './extension', name: 'defineExtension' },
]
