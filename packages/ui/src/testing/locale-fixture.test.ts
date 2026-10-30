import { pseudoLocalize } from '@mcthaydt/automata-content/locale'
import { afterEach, describe, expect, test } from 'vitest'
import { FIXTURE_LOCALES, findUntranslated, say } from './locale-fixture'

// The languages every layout contract runs its fixtures in (PRODUCT spec §4 item 7), and the check that keeps the
// xx-long run honest: a word that skipped the locale would be measured in English.

afterEach(() => {
  document.body.innerHTML = ''
})

describe('FIXTURE_LOCALES', () => {
  test('are the English stand-ins and the xx-long pseudo-locale', () => {
    expect(FIXTURE_LOCALES).toEqual(['en', 'xx-long'])
  })
})

describe('say', () => {
  test('says a word as written in English', () => {
    expect(say('en', 'Play')).toBe('Play')
  })

  test('says it in its xx-long form in xx-long', () => {
    expect(say('xx-long', 'Play')).toBe(pseudoLocalize('Play'))
  })
})

describe('findUntranslated', () => {
  test('passes a page whose words are all in xx-long, with digits and signs between them', () => {
    document.body.innerHTML = `<p>${pseudoLocalize('Music')} 40%</p><button>${pseudoLocalize('Play')}</button>`
    expect(findUntranslated(document.body)).toEqual([])
  })

  test('names a word that skipped the locale', () => {
    document.body.innerHTML = `<p>${pseudoLocalize('Music')}</p><button> Play </button>`
    expect(findUntranslated(document.body)).toEqual(['"Play" is not in xx-long'])
  })

  test('passes a word in an element in its own language: a language named in that language', () => {
    document.body.innerHTML = '<label><span lang="es-419">Español</span></label>'
    expect(findUntranslated(document.body)).toEqual([])
  })

  test('ignores whitespace and markup that has no words', () => {
    document.body.innerHTML = '<div>\n  <span> </span>\n  <span>12 / 30</span>\n</div>'
    expect(findUntranslated(document.body)).toEqual([])
  })
})
