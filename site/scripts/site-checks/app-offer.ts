// The app page may only link to a store once the app is on sale, and the Privacy and Terms pages must then say what the
// app collects and under what terms: a buy link with no `#app` section on either is a launch the site is not ready for.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AppOffer } from '../../src/features/app/app-offer.ts'

export function checkAppOffer(root: string, offer: AppOffer): string[] {
  const places = [...offer.phone.buy, ...offer.computer.buy].filter((place) => place.url !== null)
  if (places.length === 0) return []
  const failures = places
    .filter((place) => !place.url!.startsWith('https:'))
    .map((place) => `${place.label}: the address must start with https:`)
  for (const page of ['privacy.html', 'terms.html']) {
    const path = join(root, page)
    const hasSection = existsSync(path) && /\bid=["']app["']/.test(readFileSync(path, 'utf8'))
    if (!hasSection) failures.push(`${page}: the app is on sale but this page has no #app section`)
  }
  return failures
}
