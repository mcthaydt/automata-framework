import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AppPage from '#src/features/app/AppPage.svelte'
import { APP_OFFER, type AppOffer } from '#src/features/app/app-offer.ts'
import { CONTACT_EMAIL } from '#src/shared/site.js'

const withLinks: AppOffer = {
  ...APP_OFFER,
  phone: { ...APP_OFFER.phone, buy: [{ label: 'App Store', url: 'https://apps.example.com/automata' }] },
}

describe('/app', () => {
  it('shows both prices and the devices each covers, read from the offer', () => {
    const text = render(AppPage).container.textContent ?? ''
    for (const kind of [APP_OFFER.phone, APP_OFFER.computer]) {
      expect(text).toContain(kind.price)
      expect(text).toContain(kind.devices)
    }
    expect(APP_OFFER.phone.price).toBe('$19.99')
    expect(APP_OFFER.computer.price).toBe('$39.99')
  })

  it('reads "Coming soon" for a place to buy with no link, and it is not a link or a button', () => {
    const view = render(AppPage)
    const soon = view.getAllByText('Coming soon')
    expect(soon.length).toBe(APP_OFFER.phone.buy.length + APP_OFFER.computer.buy.length)
    for (const element of soon) expect(element.closest('a, button')).toBeNull()
  })

  it('makes a place to buy with a link a link to it', () => {
    const view = render(AppPage, { offer: withLinks })
    expect(view.getByRole('link', { name: /App Store/ }).getAttribute('href')).toBe(
      'https://apps.example.com/automata',
    )
  })

  it('says the two are separate purchases', () => {
    expect(render(AppPage).container.textContent).toContain(
      'These are two separate purchases. Buying the phone app does not unlock the computer app, or the other way round.',
    )
  })

  it('lists what is free in the browser and what is in the app, from the offer', () => {
    const view = render(AppPage)
    expect(view.getByRole('heading', { name: 'Free in your browser' })).toBeTruthy()
    expect(view.getByRole('heading', { name: 'In the app' })).toBeTruthy()
    for (const item of [...APP_OFFER.web, ...APP_OFFER.app]) expect(view.getByText(item)).toBeTruthy()
  })

  it('does not promise Writer or Sequence, which the free editor does not show at all', () => {
    expect(APP_OFFER.app.join(' ')).not.toMatch(/\b(Writer|Sequence)\b/)
  })

  it('has a help section with the project’s address', () => {
    const view = render(AppPage)
    const help = view.container.querySelector('#help')
    expect(help).not.toBeNull()
    expect(help?.querySelector(`a[href="mailto:${CONTACT_EMAIL}"]`)).not.toBeNull()
  })
})
