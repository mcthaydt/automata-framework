import { describe, expect, it } from 'vitest'
import { suiteEntries } from '#src/features/suite/shell/suite-entries.ts'

// The rail lists what the build has: one entry per registered editor, in the order the page registers them, and
// Review only when there are change sets to review.
const tuner = { id: 'tuner', label: 'Tuner' }
const levels = { id: 'levels-2d', label: 'Levels' }

describe('the rail entries', () => {
  it('are the registered editors, in the order the page registers them, each opening itself', () => {
    expect(suiteEntries([tuner, levels], false)).toEqual([
      { id: 'tuner', label: 'Tuner', icon: 'sliders', editors: ['tuner'] },
      { id: 'levels-2d', label: 'Levels', icon: 'grid', editors: ['levels-2d'] },
    ])
  })

  it('end with Review, which edits nothing, when the suite has change sets', () => {
    expect(suiteEntries([tuner, levels], true).map((entry) => [entry.id, entry.editors])).toEqual([
      ['tuner', ['tuner']],
      ['levels-2d', ['levels-2d']],
      ['review', []],
    ])
  })

  it('draw each entry with an icon: its own where the rail knows the editor, the list for one it does not', () => {
    const entries = suiteEntries(
      [tuner, levels, { id: 'levels-3d', label: 'Levels 3D' }, { id: 'writer', label: 'Writer' }],
      true,
    )
    expect(entries.map((entry) => entry.icon)).toEqual(['sliders', 'grid', 'grid', 'list', 'review'])
  })

  it('are empty for a build with no editors and no change sets', () => {
    expect(suiteEntries([], false)).toEqual([])
  })
})
