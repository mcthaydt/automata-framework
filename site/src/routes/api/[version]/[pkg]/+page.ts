import { error } from '@sveltejs/kit'
import { API_VERSION, getApiReference } from '../../../../shared/framework/api-reference'
import type { EntryGenerator, PageLoad } from './$types'

export const prerender = true

export const entries: EntryGenerator = () =>
  (getApiReference(API_VERSION)?.packages ?? []).map((pkg) => ({ version: API_VERSION, pkg: pkg.slug }))

export const load: PageLoad = ({ params }) => {
  const reference = getApiReference(params.version)
  const pkg = reference?.packages.find((p) => p.slug === params.pkg)
  if (!reference || !pkg) error(404, 'That package is not in this version of the reference')
  return { version: reference.version, pkg }
}
