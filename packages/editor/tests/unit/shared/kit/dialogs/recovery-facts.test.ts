import { describe, expect, it } from 'vitest'
import { recoveryFacts } from '#src/shared/kit/dialogs/recovery-facts.ts'

// What the Restore dialog says about an autosave (moved from editor-2d's `open-flow-model.test.ts` in ED3D.5c).

describe('recoveryFacts', () => {
  const now = 1_700_000_000_000
  it('names the file, when the autosave was made and that the file is as it was', () => {
    expect(
      recoveryFacts(
        'levels/mossgate.af2d.json',
        { payload: '', savedAt: now - 5 * 60_000, baseChanged: false },
        now,
      ),
    ).toEqual([
      { label: 'File', value: 'mossgate.af2d.json' },
      { label: 'Last autosave', value: '5 min ago' },
      { label: 'File on disk', value: 'Unchanged since the autosave began' },
    ])
  })
  it('says when the file changed too, since restoring replaces that change', () => {
    const facts = recoveryFacts('a.af2d.json', { payload: '', savedAt: now, baseChanged: true }, now)
    expect(facts[2]).toEqual({ label: 'File on disk', value: 'Changed since the autosave began' })
  })
})
