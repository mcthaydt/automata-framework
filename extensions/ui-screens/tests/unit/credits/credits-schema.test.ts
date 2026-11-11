import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { compileContentResult } from '@automata/content'
import { afterEach, describe, expect, it } from 'vitest'
import { creditsContent } from '#src/shared/credits/credits.content.ts'
import { creditsSchema } from '#src/shared/credits/credits.schema.ts'

// The credits file: sections of names, a name with an optional role and an optional link. It is strict, a link is
// `https:` only, and a section's title and a name's role are words `automata words` translates; a name is not.

const one = (name: Record<string, unknown>) => ({ sections: [{ title: 'Game', names: [name] }] })

describe('creditsSchema', () => {
  it('needs at least one section', () => {
    expect(creditsSchema.safeParse({ sections: [] }).success).toBe(false)
  })

  it('needs at least one name in each section', () => {
    expect(creditsSchema.safeParse({ sections: [{ title: 'Game', names: [] }] }).success).toBe(false)
  })

  it('takes a link that is https only', () => {
    expect(creditsSchema.safeParse(one({ name: 'A', url: 'http://x.test' })).success).toBe(false)
    expect(creditsSchema.safeParse(one({ name: 'A', url: 'javascript:alert(1)' })).success).toBe(false)
    expect(creditsSchema.safeParse(one({ name: 'A', url: 'https://user:pw@x.test' })).success).toBe(false)
    expect(creditsSchema.safeParse(one({ name: 'A', url: 'not a url' })).success).toBe(false)
    expect(creditsSchema.safeParse(one({ name: 'A', url: 'https://x.test/a?b=1' })).success).toBe(true)
  })

  it('is strict: a field it does not know is refused, in a section or in a name', () => {
    expect(creditsSchema.safeParse(one({ name: 'A', extra: 1 })).success).toBe(false)
    expect(
      creditsSchema.safeParse({ sections: [{ title: 'Game', names: [{ name: 'A' }], extra: 1 }] }).success,
    ).toBe(false)
  })

  it('keeps a name’s role and link', () => {
    const parsed = creditsSchema.parse(one({ name: 'A', role: 'Design', url: 'https://x.test' }))
    expect(parsed.sections[0]?.names[0]).toEqual({ name: 'A', role: 'Design', url: 'https://x.test' })
  })

  it('refuses an empty name, title or role', () => {
    expect(creditsSchema.safeParse(one({ name: '' })).success).toBe(false)
    expect(creditsSchema.safeParse({ sections: [{ title: '', names: [{ name: 'A' }] }] }).success).toBe(false)
    expect(creditsSchema.safeParse(one({ name: 'A', role: '' })).success).toBe(false)
  })
})

describe('the credits content kind', () => {
  let root = ''
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  const TOML = `
[[sections]]
title = "Game"
names = [{ name = "Ada", role = "Design", url = "https://ada.test" }, { name = "Bo" }]

[[sections]]
title = "Music"
names = [{ name = "Cy", role = "Composer" }]
`

  it('hands translators each section’s title and each name’s role, and leaves names alone', async () => {
    root = mkdtempSync(join(tmpdir(), 'credits-'))
    mkdirSync(join(root, 'content', 'credits'), { recursive: true })
    writeFileSync(join(root, 'content', 'credits', 'credits.toml'), TOML)
    const result = await compileContentResult({ root, schemas: [creditsContent] })
    if (!result.ok) throw new Error(`the compile failed: ${result.error.message}`)
    const english = result.content.catalogs.get('en') ?? {}
    expect(english).toMatchObject({
      content_credits_credits_sections_0_title: 'Game',
      content_credits_credits_sections_0_names_0_role: 'Design',
      content_credits_credits_sections_1_title: 'Music',
      content_credits_credits_sections_1_names_0_role: 'Composer',
    })
    expect(Object.values(english)).not.toContain('Ada')
  })

  it('refuses a file with an http link, at compile time', async () => {
    root = mkdtempSync(join(tmpdir(), 'credits-'))
    mkdirSync(join(root, 'content', 'credits'), { recursive: true })
    writeFileSync(
      join(root, 'content', 'credits', 'credits.toml'),
      TOML.replace('https://ada.test', 'http://ada.test'),
    )
    expect((await compileContentResult({ root, schemas: [creditsContent] })).ok).toBe(false)
  })
})
