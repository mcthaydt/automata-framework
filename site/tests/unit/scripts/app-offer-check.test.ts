// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { APP_OFFER, type AppOffer } from '#src/features/app/app-offer.ts'
import { checkAppOffer } from '../../../scripts/site-checks/app-offer.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function build(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'app-offer-'))
  roots.push(root)
  mkdirSync(root, { recursive: true })
  for (const [name, text] of Object.entries(files)) writeFileSync(join(root, name), text)
  return root
}

const forSale: AppOffer = {
  ...APP_OFFER,
  phone: { ...APP_OFFER.phone, buy: [{ label: 'App Store', url: 'https://apps.example.com/automata' }] },
}

describe('checkAppOffer', () => {
  it('finds no problem while every address is null', () => {
    expect(checkAppOffer(build({}), APP_OFFER)).toEqual([])
  })

  it('needs an #app section in privacy.html and terms.html once an address is set', () => {
    const root = build({ 'privacy.html': '<h2 id="app">The app</h2>', 'terms.html': '<h2>Other</h2>' })
    expect(checkAppOffer(root, forSale)).toEqual([
      'terms.html: the app is on sale but this page has no #app section',
    ])
    writeFileSync(join(root, 'terms.html'), '<h2 id="app">The app</h2>')
    expect(checkAppOffer(root, forSale)).toEqual([])
  })

  it('refuses an address that is not https:', () => {
    const http: AppOffer = {
      ...APP_OFFER,
      phone: { ...APP_OFFER.phone, buy: [{ label: 'App Store', url: 'http://apps.example.com' }] },
    }
    const root = build({ 'privacy.html': 'id="app"', 'terms.html': 'id="app"' })
    expect(checkAppOffer(root, http)).toEqual(['App Store: the address must start with https:'])
  })
})
