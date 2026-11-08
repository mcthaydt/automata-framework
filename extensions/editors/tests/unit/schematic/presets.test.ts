// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { EDITOR_LIST_PATH } from '@automata/editor/editor-list'
import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { checkSystems, systemsDefShape } from '@automata/systems/sim'
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { CONTENT_SAMPLE_GAME } from '#src/app/suite/sample-game.ts'
import { PRESETS, presetAgent } from '#src/features/schematic/presets.ts'
import SchematicPanel from '#src/features/schematic/SchematicPanel.svelte'
import { createSchematic } from '#src/features/schematic/schematic-suite-editor.ts'
import { newSystemsFile } from '#src/features/schematic/starter.ts'

const PLACES = ['door', 'desk', 'window']

describe('the sim tests run what the menu writes', () => {
  it('keeps the systems package’s fixture equal to the presets on the clinic’s first three stops', () => {
    const path = createRequire(import.meta.url).resolve('@automata/systems/testing/fixtures/presets.json')
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    const expected = Object.fromEntries(
      PRESETS.map((p) => [p.kind, presetAgent(p.kind, p.kind, ['end', 'cmid', 'mouth'])]),
    )
    expect(fixture).toEqual(JSON.parse(JSON.stringify(expected)))
  })
})

describe('the ready-made behaviours', () => {
  it('lists the five, each with a line of words', () => {
    expect(PRESETS.map((p) => p.title)).toEqual(['Guard', 'Sentry', 'Hunter', 'Coward', 'Wanderer'])
    for (const preset of PRESETS) expect(preset.words.length).toBeGreaterThan(20)
  })

  it.each(PRESETS.map((p) => p.kind))('%s passes the shape and the checks', (kind) => {
    const agent = presetAgent(kind, kind, PLACES)
    const def = newSystemsFile('hall', agent)
    expect(systemsDefShape.safeParse(def).success).toBe(true)
    const found: string[] = []
    checkSystems(def, { hooks: [] }, (_path, message) => found.push(message))
    expect(found).toEqual([])
    expect(agent.routine?.length).toBeGreaterThan(0)
    expect(agent.routine?.[0]?.node).toBe('door')
  })

  it('gives the sentry one stop and the others up to three, in the scene’s order', () => {
    expect(presetAgent('sentry', 's', PLACES).routine).toEqual([{ node: 'door', dwell: 1 }])
    expect(presetAgent('wanderer', 'w', PLACES).routine?.map((s) => s.node)).toEqual(PLACES)
    expect(presetAgent('guard', 'g', ['only']).routine).toEqual([{ node: 'only', dwell: 2 }])
    expect(presetAgent('guard', 'g', []).routine).toBeUndefined()
  })
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('adding one in the panel', () => {
  it('writes a character with a unique name and the scene’s first places as its stops', async () => {
    const { ports } = await createMemoryPorts({
      files: {
        [EDITOR_LIST_PATH]: CONTENT_SAMPLE_GAME[EDITOR_LIST_PATH] as string,
        'content/systems/hall.toml': CONTENT_SAMPLE_GAME['content/systems/hall.toml'] as string,
        'content/nav/hall.toml': CONTENT_SAMPLE_GAME['content/nav/hall.toml'] as string,
      },
      classify: (path) => ({
        path,
        editor: 'schematic',
        gates: [],
        checks: [],
        modes: ['edit'],
        writable: true,
      }),
      changeSet: false,
    })
    const session = await createSchematic().open(await ports.workspace.files('schematic'), ports)
    render(SchematicPanel, { props: { session } })
    const menu = await screen.findByLabelText('Add a ready-made character')
    await userEvent.selectOptions(menu, 'guard')
    await userEvent.selectOptions(screen.getByLabelText('Add a ready-made character'), 'guard')
    const ids = session.def?.agents.map((a) => a.id)
    expect(ids).toEqual(['guard', 'guard-2', 'guard-3'])
    expect(session.def?.agents[2]?.routine?.map((s) => s.node)).toEqual(['door', 'desk', 'window'])
    expect(session.problems).toEqual([])
  })
})
