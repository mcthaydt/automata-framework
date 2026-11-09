import { render } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import AppPage from '#src/features/app/AppPage.svelte'
import { APP_OFFER, type AppOffer } from '#src/features/app/app-offer.ts'
import { APP_PRICES, NO_CREDITS } from '#src/shared/content/pricing.ts'
import { CONTACT_EMAIL } from '#src/shared/site.js'

const withLinks: AppOffer = {
  ...APP_OFFER,
  phone: {
    ...APP_OFFER.phone,
    buy: [{ label: 'App Store', url: 'https://apps.example.com/automata' }],
  },
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

  it('lists what is free in the browser, and what each download gives inside its own price', () => {
    const view = render(AppPage)
    expect(view.getByRole('heading', { name: 'Free in your browser' })).toBeTruthy()
    for (const item of APP_OFFER.web) expect(view.getByText(item)).toBeTruthy()
    for (const kind of [APP_OFFER.phone, APP_OFFER.computer]) {
      const card = view.getByRole('region', { name: kind.name })
      for (const item of kind.gives) expect(card.textContent).toContain(item)
    }
  })

  it('says every editor is free on the web and charges only for the download (Owner, 2026-11-08 21:25)', () => {
    const text = render(AppPage).container.textContent ?? ''
    expect(text).toContain('Every editor is free on the web. You pay only to download the app')
    expect(APP_OFFER.web[0]).toMatch(/^All the editors/)
    expect(text).not.toMatch(/more editors|full suite/i)
    // The Owner, 2026-11-09 01:46: an app sells no setup and what only an app can do, never a limit of the free web
    // editor. So no download names an editor, sync (free on the web) or keeping your work.
    for (const kind of [APP_OFFER.phone, APP_OFFER.computer])
      expect(kind.gives.join(' ')).not.toMatch(
        /\b(Levels|Characters|Tuner|Feel|Audio|Schematic|Writer|Sequence|editors on)\b|GitHub|sync|saves? your|keeps? your work|storage/i,
      )
  })

  it('sells the computer app as no setup, and the phone and tablet app iPad first (Owner, 2026-11-09)', () => {
    expect(APP_OFFER.computer.gives[0]).toMatch(/^Nothing to set up/)
    expect(APP_OFFER.phone.devices).toMatch(/^iPad/)
    expect(APP_OFFER.phone.gives.join(' ')).toMatch(/Apple Pencil/)
  })

  it('says there are no credits and why, from the one place prices live', () => {
    const view = render(AppPage)
    expect(view.getByRole('heading', { level: 1 }).textContent).toBe(
      'Free to make games. Pay once for the app.',
    )
    expect(view.getByRole('heading', { name: 'Why there are no credits' })).toBeTruthy()
    expect(view.container.textContent).toContain(NO_CREDITS)
    expect(APP_OFFER.phone.price).toBe(APP_PRICES.phone)
    expect(APP_OFFER.computer.price).toBe(APP_PRICES.computer)
    // The repository is private until launch, so the page says MIT licensed, never open source.
    expect(view.container.textContent).not.toMatch(/open source/i)
  })

  it('has a help section with the project’s address', () => {
    const view = render(AppPage)
    const help = view.container.querySelector('#help')
    expect(help).not.toBeNull()
    expect(help?.querySelector(`a[href="mailto:${CONTACT_EMAIL}"]`)).not.toBeNull()
  })
})
