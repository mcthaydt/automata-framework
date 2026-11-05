import { describe, expect, it } from 'vitest'
import { parseBranches, prune } from '#src/prune-branches.ts'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
const C = 'c'.repeat(40)

const LIST = `# Branches

Prose is ignored, and so is any section that is not one of the three below.

## delete: merged into main

- \`old/one\` \`${A}\`

## tag abandoned: unmerged, no open pull request

- \`wip/two\` \`${B}\` (looks superseded)

## tag parked: drafts kept for a later phase

- \`claude/three\` \`${C}\`

## keep

- \`main\`
`

/**
 * A fake `git` over a remote that holds some branches and tags. It records every call, so a test can check the order
 * ("the tag is pushed before the branch is deleted") as well as the outcome.
 */
function fakeGit(options: {
  branches: Record<string, string>
  merged?: string[]
  tags?: Record<string, string>
}) {
  const branches = { ...options.branches }
  const tags = { ...options.tags }
  const merged = new Set(options.merged ?? [])
  const calls: string[] = []
  const git = (...args: string[]): string => {
    calls.push(args.join(' '))
    const [command, ...rest] = args
    if (command === 'ls-remote') {
      // ls-remote origin refs/heads/<name> | refs/tags/<name>
      const ref = rest[1] ?? ''
      const sha = ref.startsWith('refs/heads/') ? branches[ref.slice(11)] : tags[ref.slice(10)]
      return sha === undefined ? '' : `${sha}\t${ref}\n`
    }
    if (command === 'merge-base') {
      if (!merged.has(rest[1] ?? '')) throw new Error('not an ancestor')
      return ''
    }
    if (command === 'tag') {
      const [, name, sha] = rest // tag -f <name> <sha>
      if (name !== undefined && sha !== undefined) tags[name] = sha
      return ''
    }
    if (command === 'push') {
      if (rest[1] === '--delete') delete branches[rest[2] ?? '']
      return ''
    }
    throw new Error(`unexpected git ${args.join(' ')}`)
  }
  return { git, calls, branches, tags }
}

describe('parseBranches', () => {
  it('reads each section into entries with the tag its heading names', () => {
    expect(parseBranches(LIST)).toEqual([
      { branch: 'old/one', sha: A, tag: undefined },
      { branch: 'wip/two', sha: B, tag: 'abandoned/wip/two' },
      { branch: 'claude/three', sha: C, tag: 'parked/claude/three' },
    ])
  })

  it('stops on a bullet it cannot read, rather than skip a branch', () => {
    const bad = '## delete: merged\n\n- `old/one` `not-a-sha`\n'
    expect(() => parseBranches(bad)).toThrow(/old\/one/)
  })

  it('stops when a branch is listed twice, or when main is listed to go', () => {
    expect(() => parseBranches(`## delete: x\n\n- \`a\` \`${A}\`\n- \`a\` \`${A}\`\n`)).toThrow(/twice/)
    expect(() => parseBranches(`## delete: x\n\n- \`main\` \`${A}\`\n`)).toThrow(/main/)
  })
})

describe('prune', () => {
  const entries = parseBranches(LIST)
  const remote = () =>
    fakeGit({
      branches: { 'old/one': A, 'wip/two': B, 'claude/three': C },
      merged: [A],
    })

  it('is a dry run by default: it checks and reports, and changes nothing', () => {
    const fake = remote()
    const report = prune(entries, fake.git, { apply: false })
    expect(report.map((line) => line.action)).toEqual(['delete', 'tag and delete', 'tag and delete'])
    expect(fake.calls.some((call) => call.startsWith('push') || call.startsWith('tag'))).toBe(false)
    expect(Object.keys(fake.branches)).toHaveLength(3)
  })

  it('tags first, checks the tag points at the tip, then deletes', () => {
    const fake = remote()
    prune(entries, fake.git, { apply: true })
    const order = fake.calls.filter((call) => /^(tag|push)/.test(call))
    expect(order).toEqual([
      'push origin --delete old/one',
      `tag -f abandoned/wip/two ${B}`,
      'push origin refs/tags/abandoned/wip/two',
      'push origin --delete wip/two',
      `tag -f parked/claude/three ${C}`,
      'push origin refs/tags/parked/claude/three',
      'push origin --delete claude/three',
    ])
    expect(fake.branches).toEqual({})
  })

  it('stops before deleting anything when a branch moved since the list was written', () => {
    const fake = fakeGit({ branches: { 'old/one': A, 'wip/two': C, 'claude/three': C }, merged: [A] })
    expect(() => prune(entries, fake.git, { apply: true })).toThrow(/wip\/two moved/)
    expect(Object.keys(fake.branches).sort()).toEqual(['claude/three', 'old/one', 'wip/two'])
    expect(fake.calls.some((call) => /^(tag|push)/.test(call))).toBe(false)
  })

  it('stops on a "merged" branch that main does not contain', () => {
    const fake = fakeGit({ branches: { 'old/one': A }, merged: [] })
    expect(() => prune([entries[0]!], fake.git, { apply: true })).toThrow(/old\/one is not in origin\/main/)
    expect(fake.branches).toEqual({ 'old/one': A })
  })

  it('stops when the tag did not land at the tip, before the branch goes', () => {
    const fake = remote()
    // The pushed tag reads back as a different commit.
    const lying = (...args: string[]): string =>
      args[0] === 'ls-remote' && args[2]?.startsWith('refs/tags/') ? `${C}\t${args[2]}\n` : fake.git(...args)
    expect(() => prune([entries[1]!], lying, { apply: true })).toThrow(/abandoned\/wip\/two/)
    expect(fake.branches['wip/two']).toBe(B)
  })

  it('treats a branch that is already gone as done', () => {
    const fake = fakeGit({ branches: {}, merged: [] })
    const report = prune(entries, fake.git, { apply: true })
    expect(report.map((line) => line.action)).toEqual(['already gone', 'already gone', 'already gone'])
  })
})
