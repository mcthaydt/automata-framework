import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'smol-toml'
import { describe, expect, it } from 'vitest'
import { checkFlow, type FlowSource, flowSchema } from '#src/features/flow/check-flow.ts'
import { flowMermaid } from '#src/features/flow/flow-mermaid.ts'
import { FIXTURES, FLOW } from '#src/testing/fixture-game.ts'

const shipped = (): FlowSource =>
  flowSchema.parse(parse(readFileSync(join(FIXTURES, 'valid/content/flow.toml'), 'utf8')))

const withTransitions = (transitions: FlowSource['transitions']): FlowSource => ({
  ...shipped(),
  transitions,
})
const without = (from: string, event: string) =>
  withTransitions(shipped().transitions.filter((t) => !(t.from === from && t.event === event)))
const retarget = (from: string, event: string, to: string) =>
  withTransitions(shipped().transitions.map((t) => (t.from === from && t.event === event ? { ...t, to } : t)))
const messages = (flow: FlowSource, capabilities = FLOW) =>
  checkFlow(flow, capabilities).problems.map((p) => p.message)

// Ported from FloorFifty tests/content/validate/flow.test.ts (122a220), against FloorFifty's shipped
// flow.toml and its FLOW_TARGETS.
describe('checkFlow with FloorFifty capabilities', () => {
  it('accepts the shipped graph, cycles and all', () => {
    expect(checkFlow(shipped(), FLOW).problems).toEqual([])
  })

  it('rejects a wrong entry', () => {
    expect(checkFlow({ ...shipped(), entry: 'MainMenu' }, FLOW).problems).toContainEqual({
      path: ['entry'],
      code: 'invalidFlow',
      message: 'entry must be Splash, received MainMenu',
    })
  })

  it('rejects a missing pair, a disallowed target and a transition into the entry', () => {
    expect(messages(without('Gameplay', 'raceFinished'))).toContain('Gameplay.raceFinished has no transition')
    expect(messages(retarget('Gameplay', 'raceFinished', 'Splash'))).toEqual([
      'Gameplay.raceFinished may reach only GameEnd, received Splash',
      'the entry screen Splash may have no incoming transition',
    ])
  })

  it('rejects an unreachable screen', () => {
    const flow = withTransitions(shipped().transitions.filter((t) => t.to !== 'Replay'))
    expect(messages(flow)).toContain('Replay is not reachable from Splash')
  })

  it('rejects a self-transition and a duplicated pair', () => {
    expect(messages(retarget('GameEnd', 'raceAgain', 'GameEnd'))).toContain(
      'GameEnd may not transition to itself',
    )
    const duplicate = withTransitions([
      ...shipped().transitions,
      { from: 'Splash', event: 'splashComplete', to: 'MainMenu' },
    ])
    expect(messages(duplicate)).toEqual(['Splash.splashComplete is declared more than once'])
  })

  it('rejects an undeclared pair, an unknown screen and a style the game does not draw', () => {
    const flow = withTransitions([
      ...shipped().transitions,
      { from: 'Splash', event: 'skip', to: 'Credits', transition: 'wipe' },
    ])
    expect(messages(flow)).toEqual([
      'Splash declares no skip transition',
      'unknown screen Credits; expected one of Splash, MainMenu, Lobby, Gameplay, GameEnd, Tutorial, Replay',
      'transition wipe is not one of cut, liquid',
    ])
  })

  it('places each problem at its transition', () => {
    const flow = retarget('Gameplay', 'raceFinished', 'Lobby')
    const index = flow.transitions.findIndex((t) => t.from === 'Gameplay' && t.event === 'raceFinished')
    expect(checkFlow(flow, FLOW).problems[0]?.path).toEqual(['transitions', index, 'to'])
  })
})

describe('checkFlow without capabilities', () => {
  const small = (transitions: FlowSource['transitions'], terminal?: string[]): FlowSource => ({
    entry: 'Title',
    transitions,
    ...(terminal === undefined ? {} : { terminal }),
  })

  it('still checks the graph', () => {
    const flow = small([
      { from: 'Title', event: 'play', to: 'Game' },
      { from: 'Game', event: 'win', to: 'Credits' },
      { from: 'Lost', event: 'back', to: 'Title' },
    ])
    expect(checkFlow(flow).problems.map((p) => p.message)).toEqual([
      'the entry screen Title may have no incoming transition',
      'Credits has no outgoing transition',
      'Lost is not reachable from Title',
    ])
  })

  it('lets a terminal screen end the game and accepts any kebab-case style', () => {
    const flow = small(
      [
        { from: 'Title', event: 'play', to: 'Game', transition: 'fade-out' },
        { from: 'Game', event: 'win', to: 'Credits' },
      ],
      ['Credits'],
    )
    expect(checkFlow(flow).problems).toEqual([])
    expect(
      checkFlow(small([{ from: 'Title', event: 'play', to: 'Game', transition: 'Fade' }], ['Game'])).problems,
    ).toEqual([
      {
        path: ['transitions', 0, 'transition'],
        code: 'invalidFlow',
        message: 'transition styles match ^[a-z][a-z0-9-]*$',
      },
    ])
  })
})

describe('the compiled graph', () => {
  it('sorts screens and transitions, and spells out the default style', () => {
    const { graph } = checkFlow(shipped(), FLOW)
    const keys = graph.transitions.map((t) => `${t.from}.${t.event}`)
    expect(keys).toEqual([...keys].sort())
    expect(graph.screens).toEqual([
      'GameEnd',
      'Gameplay',
      'Lobby',
      'MainMenu',
      'Replay',
      'Splash',
      'Tutorial',
    ])
    expect(
      graph.transitions.find((t) => t.from === 'Splash' && t.event === 'splashComplete')?.transition,
    ).toBe('cut')
    expect(graph.transitions.find((t) => t.from === 'Lobby' && t.event === 'roomRacing')?.transition).toBe(
      'liquid',
    )
  })

  it('renders as a Mermaid state diagram', () => {
    const { graph } = checkFlow(
      {
        entry: 'Title',
        terminal: ['Credits'],
        transitions: [
          { from: 'Title', event: 'play', to: 'Game', transition: 'liquid' },
          { from: 'Game', event: 'win', to: 'Credits' },
        ],
      },
      undefined,
    )
    expect(flowMermaid(graph)).toBe(
      [
        'stateDiagram-v2',
        '  [*] --> Title',
        '  Game --> Credits: win',
        '  Title --> Game: play (liquid)',
        '  Credits --> [*]',
        '',
      ].join('\n'),
    )
  })
})
