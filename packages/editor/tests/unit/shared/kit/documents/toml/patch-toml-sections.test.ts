// @vitest-environment node
import { parse } from '@decimalturn/toml-patch'
import { describe, expect, it } from 'vitest'
import { openDocument } from '#src/shared/kit/documents/content-document.ts'
import { patchToml } from '#src/shared/kit/documents/toml/patch-toml.ts'

// biome-ignore lint/suspicious/noExplicitAny: the values are untyped TOML data that each test edits by path
type Data = Record<string, any>

/** Patches `text` from the value it parses to into `edit(value)`, and returns the new text. */
function patched(text: string, edit: (value: Data) => void): string {
  const before = parse(text) as Data
  const after = structuredClone(before)
  edit(after)
  const result = patchToml(text, before, after)
  if (!result.ok) throw new Error(`refused at ${JSON.stringify(result.path)}: ${result.detail}`)
  expect(parse(result.text)).toEqual(after)
  return result.text
}

// A new table is written the way the file writes its own: a section, never an inline table, wherever the file keeps
// the tables of that kind. (L9 of the content editors' build audit: a new Writer part was an inline table at the top.)
describe('patchToml: a new table is a section', () => {
  const EVENTS = `# What plays.
[[event]]
on = "a"
cue = "x"

# The second.
[[event]]
on = "b"
cue = "y"

[master]
gain = 1
`

  it('a row added to a list of sections goes after the last of them, with the comments left where they were', () => {
    const out = patched(EVENTS, (value) => {
      value.event.push({ on: 'c', cue: 'z' })
    })
    expect(out).toBe(`# What plays.
[[event]]
on = "a"
cue = "x"

# The second.
[[event]]
on = "b"
cue = "y"

[[event]]
on = "c"
cue = "z"

[master]
gain = 1
`)
  })

  it('a list the file does not have yet is made at the end, as sections', () => {
    const out = patched('[[cue]]\nid = "a"\nbus = "sfx"\n', (value) => {
      value.event = [{ on: 'hit', cue: 'a' }]
    })
    expect(out).toBe('[[cue]]\nid = "a"\nbus = "sfx"\n\n[[event]]\non = "hit"\ncue = "a"\n')
  })

  it("a row's own lists and tables are sections under it, after the last section of the same list", () => {
    const text = `[[cue]]
id = "a"
bus = "sfx"

[[cue.voices]]
tone = "sine"
from = 1
to = 2
length = 1
volume = 1

[[duck]]
bus = "voice"
duck = ["music"]
db = -6
attack = 0.1
release = 0.5
`
    const out = patched(text, (value) => {
      value.cue.push({
        id: 'b',
        bus: 'sfx',
        voices: [{ tone: 'square', from: 3, to: 4, length: 2, volume: 0.5 }],
      })
    })
    expect(out).toBe(`[[cue]]
id = "a"
bus = "sfx"

[[cue.voices]]
tone = "sine"
from = 1
to = 2
length = 1
volume = 1

[[cue]]
id = "b"
bus = "sfx"

[[cue.voices]]
tone = "square"
from = 3
to = 4
length = 2
volume = 0.5

[[duck]]
bus = "voice"
duck = ["music"]
db = -6
attack = 0.1
release = 0.5
`)
  })

  it('a table under a table the file writes as sections is a section beside its siblings', () => {
    const text = '[graphs.nodes.start]\nsay = ["hi"]\n\n[graphs.nodes.end]\nsay = ["bye"]\n\n[other]\na = 1\n'
    const out = patched(text, (value) => {
      value.graphs.nodes.joke = { say: ['knock knock'], next: 'end' }
    })
    expect(out).toBe(
      '[graphs.nodes.start]\nsay = ["hi"]\n\n[graphs.nodes.end]\nsay = ["bye"]\n\n[graphs.nodes.joke]\nsay = ["knock knock"]\nnext = "end"\n\n[other]\na = 1\n',
    )
  })

  it('a key that needs quotes is quoted in its header', () => {
    const out = patched('[nodes.a]\nx = 1\n', (value) => {
      value.nodes['two words'] = { x: 2 }
    })
    expect(out).toBe('[nodes.a]\nx = 1\n\n[nodes."two words"]\nx = 2\n')
  })

  it('the first row of a file with only a comment is the first section', () => {
    expect(
      patched("# The game's sounds.\n", (value) => {
        value.cue = [{ id: 'a', bus: 'sfx', voices: [] }]
      }),
    ).toBe('# The game\'s sounds.\n\n[[cue]]\nid = "a"\nbus = "sfx"\nvoices = []\n')
    expect(
      patched('', (value) => {
        value.cue = [{ id: 'a', bus: 'sfx', voices: [] }]
      }),
    ).toBe('[[cue]]\nid = "a"\nbus = "sfx"\nvoices = []\n')
  })

  it('a file without a final newline still gets its section on a line of its own', () => {
    const out = patched('[[event]]\non = "a"\ncue = "x"', (value) => {
      value.event.push({ on: 'b', cue: 'y' })
    })
    expect(out).toBe('[[event]]\non = "a"\ncue = "x"\n\n[[event]]\non = "b"\ncue = "y"')
  })

  it('CRLF text gets CRLF', () => {
    const out = patched('[[event]]\r\non = "a"\r\ncue = "x"\r\n', (value) => {
      value.event.push({ on: 'b', cue: 'y' })
    })
    expect(out).toBe('[[event]]\r\non = "a"\r\ncue = "x"\r\n\r\n[[event]]\r\non = "b"\r\ncue = "y"\r\n')
  })

  it('a list the file writes inline stays inline: sections would redefine it', () => {
    const text = 'event = [{on = "a", cue = "x"}]\n'
    const out = patched(text, (value) => {
      value.event.push({ on: 'b', cue: 'y' })
    })
    expect(out).not.toContain('[[event]]')
  })

  it('a table inside a table the file writes inline stays inline', () => {
    const text = '[graphs]\nnodes = {start = {say = ["hi"]}}\n'
    const out = patched(text, (value) => {
      value.graphs.nodes.joke = { say: ['x'] }
    })
    expect(out).not.toContain('[graphs.nodes.joke]')
  })

  it('an empty table is written {} where it is, not as a section of its own', () => {
    const out = patched('[[rule]]\nslot = "a"\n', (value) => {
      value.rule.push({ when: {}, slot: 'b' })
    })
    expect(out).toBe('[[rule]]\nslot = "a"\n\n[[rule]]\nwhen = {}\nslot = "b"\n')
  })

  it('the first row of a list that has an empty table keeps it as {} too', () => {
    const out = patched('[[slot]]\nid = "a"\n', (value) => {
      value.rule = [{ when: {}, slot: 'a' }]
    })
    expect(out).toBe('[[slot]]\nid = "a"\n\n[[rule]]\nwhen = {}\nslot = "a"\n')
  })

  it('a scalar key added in the same patch is still written where toml-patch writes it', () => {
    const out = patched('[[event]]\non = "a"\ncue = "x"\n', (value) => {
      value.master_gain = 0.5
      value.event.push({ on: 'b', cue: 'y' })
    })
    expect(out).toContain('master_gain = 0.5')
    expect(out.match(/\[\[event\]\]/g)).toHaveLength(2)
  })
})

describe('openDocument: edits add sections', () => {
  it('adding a row to a list the file lacks, in one edit, writes [[event]] and nothing at the top', () => {
    const document = openDocument('audio.toml', '[[cue]]\nid = "a"\nbus = "sfx"\nvoices = []\n')
    const result = document.edit([{ keyPath: ['event'], insert: [{ on: 'hit', cue: 'a' }] }])
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.document.text).toBe(
        '[[cue]]\nid = "a"\nbus = "sfx"\nvoices = []\n\n[[event]]\non = "hit"\ncue = "a"\n',
      )
  })

  it('an insert at a list that exists adds a section after its last', () => {
    const document = openDocument('audio.toml', '[[event]]\non = "a"\ncue = "x"\n')
    const result = document.edit([{ keyPath: ['event'], insert: { on: 'b', cue: 'y' } }])
    expect(result.ok && result.document.text).toBe(
      '[[event]]\non = "a"\ncue = "x"\n\n[[event]]\non = "b"\ncue = "y"\n',
    )
  })
})
