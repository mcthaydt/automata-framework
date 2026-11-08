import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import CreditsPage from '#src/features/credits/CreditsPage.svelte'
import { CREDIT_GROUPS, CREDITS } from '#src/features/credits/credits-data.ts'
import Footer from '#src/shared/components/Footer.svelte'
import { BANNED_PHRASES, checkStandalone } from '../../../scripts/site-checks/copy'

describe('/credits', () => {
  it('has one h1 and a heading for each group', () => {
    const view = render(CreditsPage)
    expect(view.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const group of CREDIT_GROUPS)
      expect(view.getByRole('heading', { level: 2, name: group.title })).toBeTruthy()
  })

  it('shows every credit as a link to its home with its plain line and licence', () => {
    const view = render(CreditsPage)
    for (const credit of CREDITS) {
      const link = view.getByRole('link', { name: credit.name })
      expect(link.getAttribute('href'), credit.name).toBe(credit.url)
      const row = link.closest('li')
      expect(row, credit.name).not.toBeNull()
      expect(row?.textContent, credit.name).toContain(credit.what)
      expect(row?.textContent, credit.name).toContain(credit.licence)
    }
  })

  it('opens other sites safely', () => {
    const view = render(CreditsPage)
    for (const link of view.container.querySelectorAll('li a'))
      expect(link.getAttribute('rel')?.split(' '), link.textContent ?? '').toEqual(
        expect.arrayContaining(['noopener', 'noreferrer']),
      )
  })

  it('says in plain words that these keep their own licences', () => {
    const text = render(CreditsPage).container.textContent ?? ''
    expect(text).toMatch(/own licen[cs]e/i)
    expect(text).toMatch(/thank/i)
  })

  it('keeps to the site’s copy rules: no banned phrase, no reference project named', () => {
    const text = render(CreditsPage).container.textContent ?? ''
    for (const phrase of BANNED_PHRASES) expect(text, phrase.label).not.toMatch(phrase.pattern)
    expect(checkStandalone('credits.html', text)).toEqual([])
  })

  it('is linked from the footer', () => {
    const link = render(Footer).getByRole('link', { name: 'Credits' })
    expect(link.getAttribute('href')).toBe('/credits')
  })
})
