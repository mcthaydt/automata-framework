import { flushSync, mount, unmount } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LanguageSection from '#src/app/screens/settings/LanguageSection.svelte'
import { endonymOf, type LanguageCopy } from '#src/app/screens/settings/language-section.ts'

// The Language group of the Settings tab (Owner, 2026-10-18): Automatic, then each of the game's languages named in its own language (its endonym), each in its own
// `lang`. A pick applies at once.

const copy: LanguageCopy = { title: 'Language', automatic: 'Automatic' }

let component: ReturnType<typeof mount> | undefined
afterEach(() => {
  if (component !== undefined) unmount(component)
  component = undefined
  document.body.innerHTML = ''
})

function open(choice: string | null = null, names?: Readonly<Record<string, string>>) {
  const onchange = vi.fn()
  const host = document.createElement('div')
  document.body.append(host)
  component = mount(LanguageSection, {
    target: host,
    props: {
      copy,
      locales: ['en', 'ja', 'pt-BR'],
      choice,
      onchange,
      ...(names === undefined ? {} : { names }),
    },
  })
  flushSync()
  const section = host.querySelector<HTMLElement>('[data-settings-section="language"]') as HTMLElement
  return { section, onchange }
}

// `endonymOf` itself is content's, tested there (`packages/content/src/locale/endonyms.test.ts`, M5.5F); ui
// re-exports it.
describe('endonymOf from ui', () => {
  it('is content’s function, re-exported', async () => {
    const content = await import('@automata/content/locale')
    expect(endonymOf).toBe(content.endonymOf)
  })
})

describe('LanguageSection', () => {
  it('offers Automatic, then each language by its endonym in its own lang, the choice checked', () => {
    const { section } = open('ja')
    expect(section.querySelector('h3')?.textContent).toBe('Language')
    const options = [...section.querySelectorAll<HTMLInputElement>('input[type="radio"]')]
    expect(
      options.map((input) => [
        input.value,
        input.closest('label')?.textContent?.replace('✓', '').replace(/\s+/g, ' ').trim(),
        input.closest('label')?.getAttribute('lang'),
        input.checked,
      ]),
    ).toEqual([
      ['', 'Automatic', null, false],
      ['en', 'English', 'en', false],
      ['ja', '日本語', 'ja', true],
      ['pt-BR', endonymOf('pt-BR'), 'pt-BR', false],
    ])
  })

  it('checks Automatic when nothing is picked, and reports a pick or Automatic', () => {
    const automatic = open()
    expect(automatic.section.querySelector<HTMLInputElement>('input[value=""]')?.checked).toBe(true)
    automatic.section.querySelector<HTMLInputElement>('input[value="ja"]')?.click()
    expect(automatic.onchange).toHaveBeenLastCalledWith('ja')
    unmount(component as ReturnType<typeof mount>)
    // Controlled: the owner passes the new choice back; from a pick, Automatic reports null.
    const picked = open('ja')
    picked.section.querySelector<HTMLInputElement>('input[value=""]')?.click()
    expect(picked.onchange).toHaveBeenLastCalledWith(null)
  })

  it('uses the game’s own name for a language where it gives one', () => {
    const { section } = open(null, { 'pt-BR': 'Português (Brasil)' })
    expect(section.querySelector('input[value="pt-BR"]')?.closest('label')?.textContent?.trim()).toBe(
      'Português (Brasil)',
    )
  })
})
