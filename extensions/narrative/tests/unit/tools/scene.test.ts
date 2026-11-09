// The scene runner: what the pipeline does with a game's `NarrativeToolsScene`: lint it, play its routes
// for beat coverage and hints, check its puzzle help, and write its screenplay and help doc. The toy scene is sound;
// each case breaks one thing.
import { describe, expect, it } from 'vitest'
import type { Finding } from '#src/features/tools/finding.ts'
import { coverageOf, helpDoc, helpFindings, lintScene, screenplayOf } from '#src/features/tools/scene.ts'
import { TOY_RECORDS, toyNarrativeScene, toyTraceGame } from '#src/testing/toy-trace.ts'

const errors = (found: readonly Finding[]) => found.filter((f) => f.level === 'error')

describe('lintScene', () => {
  it('passes a sound scene', () => {
    const lint = lintScene(toyNarrativeScene())
    expect(errors(lint.narrative)).toEqual([])
    expect(errors(lint.dialogue)).toEqual([])
    expect(errors(lint.deck)).toEqual([])
  })
  it('reads the text from the locale: a key with no text is an error', () => {
    const lint = lintScene(toyNarrativeScene({ text: {} }))
    expect(lint.narrative.some((f) => f.rule === 'text')).toBe(true)
  })
  it('fails a conversation with a dead end', () => {
    const game = toyTraceGame({
      graphs: [
        {
          id: 'meet',
          speaker: 'porter',
          start: 'a',
          nodes: {
            a: {
              say: ['toy.hello'],
              choices: [
                { line: 'toy.duty', next: 'b' },
                { line: 'toy.unsure', next: 'b' },
              ],
            },
            b: { say: ['toy.ask'], next: 'a' },
          },
        },
      ],
    })
    expect(errors(lintScene(toyNarrativeScene({ game })).dialogue).map((f) => f.rule)).toEqual(['exit'])
  })
  it('knows a deck fact from the puzzle, the dialogue and the scene, and fails one it does not know', () => {
    const deck = (when: { fact: string; is: boolean }[]) =>
      toyNarrativeScene({
        storylets: [{ id: 'st.a', trigger: 'inspect:drawer', lines: ['toy.murmur'], when }],
        deck: { rooms: ['hall'], facts: ['read.register'] },
      })
    expect(
      errors(
        lintScene(
          deck([
            { fact: 'drawerOpen', is: true },
            { fact: 'read.register', is: true },
            { fact: 'stance', is: true },
          ]),
        ).deck,
      ),
    ).toEqual([])
    expect(errors(lintScene(deck([{ fact: 'ghost', is: true }])).deck).map((f) => f.rule)).toEqual(['when'])
  })
  it('warns of a conversation no puzzle action starts', () => {
    const game = toyTraceGame()
    const puzzle = {
      ...game.puzzle,
      def: {
        ...game.puzzle.def,
        actions: game.puzzle.def.actions.map((a) => ({
          ...a,
          then: a.then.filter((e) => !('dialogue' in e)),
        })),
      },
    }
    const lint = lintScene(toyNarrativeScene({ game: { ...game, puzzle } }))
    expect(lint.dialogue.map((f) => `${f.level} ${f.rule}`)).toEqual(['warning started'])
  })
})

describe('coverageOf', () => {
  it('plays every solver route and reports the beats, each delivered', async () => {
    const c = await coverageOf(toyNarrativeScene())
    expect(c.routes).toEqual([{ name: 'shortest', entry: 'start', steps: ['drawer.open', 'door.unlock'] }])
    expect(errors(c.findings)).toEqual([])
    expect(c.beats.filter((b) => b.required).map((b) => [b.id, b.missing])).toEqual([
      ['toy.key', []],
      ['toy.meet', []],
      ['toy.dawn', []],
    ])
  })
  it('fails a required beat no route delivers, and a message that is no line record', async () => {
    const game = toyTraceGame({ records: TOY_RECORDS.filter((r) => r.id !== 'toy.door') })
    const c = await coverageOf(
      toyNarrativeScene({
        game,
        beats: [{ id: 'toy.never', learn: 'x', required: true, deliveredBy: ['toy.nothing'] }],
      }),
    )
    expect(errors(c.findings).map((f) => f.rule)).toEqual(['required', 'unrecorded'])
  })
  it('checks the hints against the lethal rules, with the lines each route shows before the risk', async () => {
    const base = toyNarrativeScene()
    const puzzle = {
      ...base.game.puzzle,
      def: {
        ...base.game.puzzle.def,
        systemic: [
          {
            id: 'leak',
            note: 'n',
            enables: [{ fact: 'wet', is: true }],
            via: ['door.unlock'],
            risk: 'lethal' as const,
          },
        ],
        lethal: [{ id: 'liveWater', rule: 'A wet floor kills.', hintedBy: ['drawer.open'] }],
      },
    }
    const c = await coverageOf({ ...base, game: { ...base.game, puzzle } })
    expect(c.hints.findings.map((f) => `${f.rule} ${f.id}`)).toEqual([
      'untagged liveWater',
      'hint-line liveWater',
    ])
    const tagged = toyTraceGame({
      puzzle,
      records: TOY_RECORDS.map((r) => (r.id === 'toy.drawer' ? { ...r, hints: ['liveWater'] } : r)),
    })
    expect((await coverageOf({ ...base, game: tagged })).hints.rules).toEqual([
      { id: 'liveWater', tagged: ['toy.drawer'], ok: true },
    ])
  })
})

describe('helpFindings and helpDoc', () => {
  it('passes the toy help on every route', () => {
    expect(errors(helpFindings(toyNarrativeScene()))).toEqual([])
  })
  it('fails a scene with no help', () => {
    expect(helpFindings(toyNarrativeScene({ help: undefined })).map((f) => f.rule)).toEqual(['missing'])
  })
  it('writes each ladder’s three hints and each deduction’s clues, with the text and where it is met', () => {
    const md = helpDoc(toyNarrativeScene(), 'sources: toy')
    expect(md.split('\n').slice(0, 2)).toEqual([
      '<!-- Generated by `automata pipe narrative help`. Do not edit: change the help, the lines or the puzzle and regenerate. -->',
      '<!-- sources: toy -->',
    ])
    expect(md).toContain('### `drawer`: Find the key.')
    expect(md).toContain('1. “Cold tonight. The river is high.” — `toy.hello` at dialogue:meet')
    expect(md).toContain('- Done when drawerOpen = true')
    expect(md).toContain('### `keyInDrawer`: The key is in the drawer.')
    expect(md).toContain('For: drawer')
  })
})

describe('screenplayOf', () => {
  it('writes the act screenplay from the played routes, the same twice', async () => {
    const scene = toyNarrativeScene()
    const played = await coverageOf(scene)
    const a = screenplayOf(scene, played, {
      act: 'toy-act',
      stamp: 'sources: toy',
      command: 'automata pipe narrative screenplay',
    })
    const b = screenplayOf(scene, await coverageOf(scene), {
      act: 'toy-act',
      stamp: 'sources: toy',
      command: 'automata pipe narrative screenplay',
    })
    expect(a).toBe(b)
    expect(a).toContain('## Toy Ward (`toy`)')
    expect(a).toContain('#### `st.murmur`')
    expect(a).toContain('Ada examines Drawer (`drawer`)')
  })
})
