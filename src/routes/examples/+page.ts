import { browser } from '$app/environment'
import { getDemoBySlug, getDemosCatalog } from '../../data/demos'
import type { PageLoad } from './$types'
export const load: PageLoad = ({ url }) => ({
  demo: getDemoBySlug(browser ? url.searchParams.get('demo') ?? '' : '')?.slug ?? getDemosCatalog()[0]?.slug,
})
