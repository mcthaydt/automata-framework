import { describe, expect, it } from 'vitest'
import { applyDocumentLocale, textDirection } from '#src/features/locale/document-locale.ts'

describe('textDirection', () => {
  it('is rtl for right-to-left scripts', () => {
    for (const tag of ['ar', 'ar-EG', 'he', 'fa', 'ur', 'yi']) expect(textDirection(tag), tag).toBe('rtl')
  })

  it('is ltr otherwise, including the pseudo-locale', () => {
    for (const tag of ['en', 'ja', 'zh-Hans', 'pt-BR', 'xx-long']) expect(textDirection(tag), tag).toBe('ltr')
  })

  it('follows an explicit script subtag', () => {
    expect(textDirection('az-Arab')).toBe('rtl')
    expect(textDirection('ug-Latn')).toBe('ltr')
  })
})

describe('applyDocumentLocale (PRODUCT spec §4 item 4)', () => {
  it('sets lang and dir on the element', () => {
    const element = document.createElement('html')
    applyDocumentLocale(element, 'ar-EG')
    expect(element.lang).toBe('ar-EG')
    expect(element.dir).toBe('rtl')
    applyDocumentLocale(element, 'fr')
    expect(element.lang).toBe('fr')
    expect(element.dir).toBe('ltr')
  })
})
