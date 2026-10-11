import { describe, expect, it } from 'vitest'
import { changesetProblems } from './check-changesets.ts'

const published = ['@mcthaydt/automata-sim', '@mcthaydt/automata-host']
const file = (body: string) => `---\n${body}\n---\n\nWhat changed.\n`

describe('changesetProblems (patch only before 1.0)', () => {
  it('passes patch bumps of published packages, in either quote style', () => {
    const files = { 'a.md': file('\'@mcthaydt/automata-sim\': patch\n"@mcthaydt/automata-host": patch') }
    expect(changesetProblems(files, published)).toEqual([])
  })

  it('passes an empty changeset (a release note with no bump)', () => {
    expect(changesetProblems({ 'empty.md': '---\n---\n' }, published)).toEqual([])
  })

  it('fails a minor or major bump, naming the file and package', () => {
    const files = {
      'm.md': file("'@mcthaydt/automata-sim': minor"),
      'x.md': file("'@mcthaydt/automata-host': major"),
    }
    expect(changesetProblems(files, published)).toEqual([
      'm.md: @mcthaydt/automata-sim is a minor bump; before 1.0 every AF changeset is a patch',
      'x.md: @mcthaydt/automata-host is a major bump; before 1.0 every AF changeset is a patch',
    ])
  })

  it('fails a package that is not published', () => {
    expect(changesetProblems({ 'u.md': file("'@af-examples/base-2d': patch") }, published)).toEqual([
      'u.md: @af-examples/base-2d is not a published package',
    ])
  })

  it('fails a file without front matter', () => {
    expect(changesetProblems({ 'bad.md': 'no front matter' }, published)).toEqual([
      'bad.md: no front matter (expected --- … --- with one package per line)',
    ])
  })
})
