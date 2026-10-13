import type { CompiledContentData, GameDefinition, RuntimeSeams } from '@mcthaydt/automata-runtime'
import { fakeFetch, nullRenderer } from '@mcthaydt/automata-runtime/testing'
import { z } from 'zod'
import type { FailMode } from './fail-mode.ts'
import { pausedScreen } from './screens/paused.ts'
import { playScreen } from './screens/play.ts'
import { titleScreen } from './screens/title.ts'

export const demoContentData: CompiledContentData = {
  flow: {
    entry: 'title',
    screens: ['title', 'play', 'paused'],
    terminal: [],
    transitions: [
      { from: 'title', event: 'play', to: 'play', transition: 'cut' },
      { from: 'play', event: 'pause', to: 'paused', transition: 'cut' },
      { from: 'paused', event: 'resume', to: 'play', transition: 'cut' },
    ],
  },
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: [],
    preload_screens: ['title'],
  },
  assets: {
    screens: {
      title: { files: ['/assets/title.txt'] },
      play: { files: ['/assets/play.txt'] },
      paused: { files: [] },
    },
  },
}

export interface DemoGameSeams extends RuntimeSeams {
  readonly root?: HTMLElement
}

/**
 * Builds the GameDefinition for the boot-and-flow demo (spec §8).
 * Configures the seams and boot options according to the requested ?fail= mode.
 */
export function demoGame(fail?: FailMode, seams?: DemoGameSeams): GameDefinition<unknown> {
  const root =
    seams?.root ??
    (typeof document !== 'undefined'
      ? (document.getElementById('game') ?? document.createElement('div'))
      : ({} as HTMLElement))

  // Fail mode: init -> invalid testHostOrigins causes Ruken.init to fail
  const hosting = {
    gameId: 'demo-runtime-boot-and-flow',
    wants: ['saves'] as const,
    pauseBehavior: 'pause' as const,
    ...(fail === 'init' ? { testHostOrigins: ['not a valid url'] } : {}),
  }

  // Fail mode: saves -> key with spaces rejected by SAVE_KEY_RE (/^[A-Za-z0-9._:-]{1,128}$/)
  const settings =
    fail === 'saves'
      ? {
          key: 'invalid key with spaces',
          version: 1,
          schema: z.object({}),
          defaults: {},
        }
      : {
          key: 'demo_settings',
          version: 1,
          schema: z.object({
            sound: z.boolean().catch(true),
          }),
          defaults: { sound: true },
        }

  // Fail mode: content -> hash mismatch
  const hash = fail === 'content' ? '0000000000000000' : '0380789e85f9ade4'
  const content = {
    data: demoContentData,
    hash,
  }

  // Fail mode: renderer -> nullRenderer with fail: true
  const renderer = fail === 'renderer' ? nullRenderer([], { fail: true }) : nullRenderer()

  // Fail mode: download -> 404, stall -> hang
  let fetchFn = seams?.fetch ?? (typeof globalThis !== 'undefined' ? globalThis.fetch : undefined)
  if (fail === 'download') {
    const mock = fakeFetch(
      { '/assets/title.txt': { status: 404 } },
      fetchFn ? { fallback: fetchFn } : undefined,
    )
    fetchFn = mock.fetch
  } else if (fail === 'stall') {
    const mock = fakeFetch(
      { '/assets/title.txt': { hang: true } },
      fetchFn ? { fallback: fetchFn } : undefined,
    )
    fetchFn = mock.fetch
  }

  const effectiveSeams: RuntimeSeams = {
    ...seams,
    ...(fetchFn ? { fetch: fetchFn } : {}),
  }

  return {
    root,
    hosting,
    content,
    screens: [titleScreen, playScreen, pausedScreen],
    renderer,
    settings,
    seams: effectiveSeams,
  }
}
