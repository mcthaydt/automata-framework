// @vitest-environment jsdom
import { render, screen } from '@testing-library/svelte'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import ThemeChoice from '#src/shared/kit/theme/ThemeChoice.svelte'
import { THEME_KEY } from '#src/shared/kit/theme/theme-choice.ts'

afterEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

const group = (): HTMLElement => screen.getByRole('radiogroup', { name: 'Editor colours' })

describe('ThemeChoice', () => {
  test('says Editor colours in visible words, with Dark, Light and Match device in that order', () => {
    render(ThemeChoice)
    expect(screen.getByText('Editor colours', { selector: '.label' })).toBeTruthy()
    const options = Array.from(group().querySelectorAll('[role="radio"]')).map((o) => o.textContent?.trim())
    expect(options).toEqual(['Dark', 'Light', 'Match device'])
  })

  test('with nothing stored, Dark is chosen', () => {
    render(ThemeChoice)
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true')
  })

  test('shows the stored choice', () => {
    localStorage.setItem(THEME_KEY, 'device')
    render(ThemeChoice)
    expect(screen.getByRole('radio', { name: 'Match device' }).getAttribute('aria-checked')).toBe('true')
  })

  test('choosing Light looks light at once, remembers it and keeps focus on Light', async () => {
    render(ThemeChoice)
    const light = screen.getByRole('radio', { name: 'Light' })
    await userEvent.click(light)
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(document.activeElement).toBe(light)
  })

  test('choosing Match device keeps the choice as "device" and lets the device decide', async () => {
    localStorage.setItem(THEME_KEY, 'dark')
    document.documentElement.dataset.theme = 'dark'
    render(ThemeChoice)
    await userEvent.click(screen.getByRole('radio', { name: 'Match device' }))
    expect(document.documentElement.dataset.theme).toBe('device')
    expect(localStorage.getItem(THEME_KEY)).toBe('device')
  })

  test('arrow keys change the look too', async () => {
    render(ThemeChoice)
    screen.getByRole('radio', { name: 'Dark' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  test('a store that refuses still changes the look for this visit, and throws nothing', async () => {
    const refuse = (): never => {
      throw new Error('blocked')
    }
    render(ThemeChoice, {
      storage: () => ({ getItem: refuse, setItem: refuse, removeItem: refuse }) as unknown as Storage,
    })
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
