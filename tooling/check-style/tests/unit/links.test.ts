import { describe, expect, it } from 'vitest'
import { checksLinks, linkFindings } from '#src/docs.ts'

// Every relative link in the docs leads somewhere: a moved or archived page breaks the link that pointed at it, and
// this says which. Web addresses, mail and same-page anchors are not files, so they are not looked for.

const present = new Set(['docs/guides/editor.md', 'docs/adr/0006-distribution-targets.md', 'docs/guides'])
const exists = (path: string) => present.has(path)
const broken = (file: string, text: string) => linkFindings(file, text, exists).map((finding) => finding.line)

describe('relative Markdown links', () => {
  it('pass when the file is there, with or without an anchor', () => {
    const text =
      '[Editor](guides/editor.md) and [ADR 6](adr/0006-distribution-targets.md#decision) and [g](guides/)\n'
    expect(broken('docs/index.md', text)).toEqual([])
  })

  it('fail, by line, when the file is not there', () => {
    const text = 'Fine.\nSee [the plan](02-master-delivery-plan.md) and [spec](../superpowers/specs/a.md).\n'
    expect(broken('docs/runbook.md', text)).toEqual([2, 2])
  })

  it('ignore web addresses, mail, anchors and code', () => {
    const text =
      '[a](https://x.dev/a.md) [b](mailto:a@b.c) [c](#top)\n```md\n[d](missing.md)\n```\n`[e](missing.md)`\n'
    expect(broken('docs/a.md', text)).toEqual([])
  })

  it('look outside the archive only', () => {
    expect(checksLinks('docs/runbook.md')).toBe(true)
    expect(checksLinks('docs/archive/old.md')).toBe(false)
    expect(checksLinks('packages/sim/CHANGELOG.md')).toBe(false)
  })
})
