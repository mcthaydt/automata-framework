import { describe, expect, it } from 'vitest'
import * as framework from '#src/entries/index.ts'

// A game with its own words needs the framework's locale pieces and should not have to copy them: the matching rule
// (so `pt` finds `pt-BR` the way the runtime does), numbers in the reader's convention, the six default languages and
// the binding that keeps plain-DOM words in the language.

describe('@automataframework/framework locale exports', () => {
  it('has matchLocale, formatNumber, DEFAULT_LOCALES and bindWords', () => {
    expect(framework.matchLocale('zh-CN', framework.DEFAULT_LOCALES)).toBe('zh-Hans')
    expect(framework.formatNumber('de', 1.5, { minimumFractionDigits: 2 })).toBe('1,50')
    expect([...framework.DEFAULT_LOCALES]).toEqual(['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])
    expect(typeof framework.bindWords).toBe('function')
  })
})
