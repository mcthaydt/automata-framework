import { describe, expect, it } from 'vitest'
import { changesetProblems, readChangeset } from '#src/check-changesets.ts'

const published = ['@automataframework/sim', '@automataframework/host']
const file = (body: string) => `---\n${body}\n---\n\nWhat changed.\n`

describe('changesetProblems (patch only before 1.0)', () => {
  it('passes patch bumps of published packages, in either quote style', () => {
    const files = { 'a.md': file('\'@automataframework/sim\': patch\n"@automataframework/host": patch') }
    expect(changesetProblems(files, published)).toEqual([])
  })

  it('passes an empty changeset (a release note with no bump)', () => {
    expect(changesetProblems({ 'empty.md': '---\n---\n' }, published)).toEqual([])
  })

  it('fails a minor or major bump, naming the file and package', () => {
    const files = {
      'm.md': file("'@automataframework/sim': minor"),
      'x.md': file("'@automataframework/host': major"),
    }
    expect(changesetProblems(files, published)).toEqual([
      'm.md: @automataframework/sim is a minor bump; before 1.0 every AF changeset is a patch',
      'x.md: @automataframework/host is a major bump; before 1.0 every AF changeset is a patch',
    ])
  })

  it('allows the one-time minor of the first public release, in its own file only', () => {
    const minor = file("'@automataframework/sim': minor")
    expect(changesetProblems({ 'first-public-release.md': minor }, published)).toEqual([])
    expect(changesetProblems({ 'other.md': minor }, published)).toEqual([
      'other.md: @automataframework/sim is a minor bump; before 1.0 every AF changeset is a patch',
    ])
    expect(
      changesetProblems({ 'first-public-release.md': file("'@automataframework/sim': major") }, published),
    ).toEqual([
      'first-public-release.md: @automataframework/sim is a major bump; before 1.0 every AF changeset is a patch',
    ])
  })

  it('fails a package that is not published', () => {
    expect(changesetProblems({ 'u.md': file("'@af-games/emberwick': patch") }, published)).toEqual([
      'u.md: @af-games/emberwick is not a published package',
    ])
  })

  it('fails a file without front matter', () => {
    expect(changesetProblems({ 'bad.md': 'no front matter' }, published)).toEqual([
      'bad.md: no front matter (expected --- … --- with one package per line)',
    ])
  })
})

describe('readChangeset (shared with tooling/api-report)', () => {
  it('reads each release line and the body after the front matter', () => {
    expect(readChangeset(`---\n'@automataframework/host': patch\n---\n\nBREAKING: a member.\n`)).toEqual({
      releases: [{ name: '@automataframework/host', bump: 'patch' }],
      body: '\nBREAKING: a member.\n',
    })
  })

  it('is undefined without front matter and skips unreadable lines', () => {
    expect(readChangeset('no front matter')).toBeUndefined()
    expect(readChangeset('---\nnot a release\n---\n')?.releases).toEqual([])
  })
})
