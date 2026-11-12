import { createMemoryPorts } from '@automata/editor/kit/ports/testing'
import { describe, expect, it } from 'vitest'
import { readGameNames } from '#src/features/sequence/sequence-names.ts'

// Who says it, who walks and who looks are people. A 2D level also names its places (a Hall, a Yard) in the same field,
// but a place has a size; it is not someone a cutscene can ask to speak.
const LEVEL = `format = "af2d-content"
version = 1
id = "start"
name = "Start"

[size]
w = 512
h = 288

[background]
color = "#1b2540"
mode = "fit"

[fields]
[[layers]]
def = "entities"
kind = "entities"

[[layers.items]]
id = "00000002"
def = "area"
x = 0
y = 0
w = 256
h = 256

[layers.items.fields]
name = "Hall"

[[layers.items]]
id = "00000004"
def = "keeper"
x = 200
y = 256

[layers.items.fields]
name = "keeper"
`

describe('the names Sequence offers', () => {
  it('offer the people a 2D level places, and not its places', async () => {
    const { ports } = await createMemoryPorts({
      files: { 'content/levels/start.toml': LEVEL },
      classify: (path) => ({
        path,
        editor: 'sequence',
        gates: [],
        checks: [],
        modes: ['edit'],
        writable: true,
      }),
    })
    const names = await readGameNames(ports, await ports.workspace.files())
    expect(names.people.map((person) => person.name)).toEqual(['keeper'])
  })
})
