// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { changelogTitle, readChangelog } from '#src/shared/framework/changelog.ts'

// The changelog is the changesets waiting for the next release: each is one real change, written for the people who
// use the packages. Its date is the day its file was added to git, when that is known.

function folderWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'af-changelog-'))
  mkdirSync(join(root, '.changeset'))
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, '.changeset', name), text)
  return root
}

describe('changelogTitle', () => {
  it('takes the first sentence and drops the code marks', () => {
    expect(changelogTitle('`automata check` has a `levels` step. It fails when two files disagree.')).toBe(
      'automata check has a levels step.',
    )
  })

  it('cuts a long first sentence at a word, with an ellipsis', () => {
    const title = changelogTitle(`${'word '.repeat(40)}end.`)
    expect(title.length).toBeLessThanOrEqual(121)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('readChangelog', () => {
  it('lists each changeset but the readme and the config, with its package names', () => {
    const root = folderWith({
      'README.md': '# Changesets',
      'config.json': '{}',
      'one.md':
        "---\n'@automata/tools': patch\n'@automata/content': patch\n---\n\nA new thing works. More words.\n",
    })
    const entries = readChangelog(root)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      id: 'one',
      title: 'A new thing works.',
      packages: ['@automata/content', '@automata/tools'],
    })
  })

  it('has no date where git cannot say one', () => {
    const root = folderWith({ 'one.md': "---\n'@automata/tools': patch\n---\nA thing.\n" })
    expect(readChangelog(root)[0]?.date).toBeUndefined()
  })
})
