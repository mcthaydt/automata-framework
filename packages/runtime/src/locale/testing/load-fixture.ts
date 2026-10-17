// The compiled Paraglide fixture (see global-setup.ts), loaded fresh in the calling test file.

import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { inject } from 'vitest'
import type { MessageFunction, ParaglideRuntime } from '../paraglide.js'

export interface ParaglideFixture {
  readonly runtime: ParaglideRuntime & { setLocale(locale: string): void }
  readonly messages: Readonly<Record<string, MessageFunction>>
}

export async function loadParaglideFixture(): Promise<ParaglideFixture> {
  const entry = pathToFileURL(join(inject('paraglideFixture'), 'fixture.js')).href
  return (await import(/* @vite-ignore */ entry)) as ParaglideFixture
}
