// The audio pipeline's renderer (M6.10b, AU-D5): the render module bundled with Vite and run in headless Chromium, because Node has
// no `OfflineAudioContext`. One browser per renderer; `close` ends it. A missing browser is an error that says so, never a skip.
import { fileURLToPath } from 'node:url'
import type { AudioContent } from '@mcthaydt/automata-audio-synth'
import { build, type Rolldown } from 'vite'

export interface CueRender {
  readonly seconds: number
  readonly place?: {
    readonly at: { readonly x: number; readonly z: number }
    readonly listener: { readonly x: number; readonly z: number; readonly yaw: number }
  }
}
export interface MixRender {
  readonly seconds: number
  readonly bed: string | null
  readonly sequence: readonly { readonly t: number; readonly cue: string }[]
}
export interface DuckRender {
  readonly seconds: number
  readonly at: number
  readonly line: string | null
  readonly bed?: string
}
/** Each render returns the channels as plain arrays. */
export interface AudioRenderer {
  cue(content: AudioContent, id: string, options: CueRender): Promise<number[][]>
  bed(content: AudioContent, id: string, seconds: number): Promise<number[][]>
  mix(content: AudioContent, mix: MixRender): Promise<number[][]>
  duck(content: AudioContent, options: DuckRender): Promise<number[][]>
  close(): Promise<void>
}

const ENTRY = fileURLToPath(import.meta.resolve('@mcthaydt/automata-audio-synth/browser'))

/** The page bundle, built once per process. */
let bundle: Promise<string> | undefined
const pageBundle = (): Promise<string> => {
  bundle ??= build({
    configFile: false,
    logLevel: 'silent',
    build: { write: false, minify: false, lib: { entry: ENTRY, formats: ['iife'], name: 'AutomataAudio' } },
  }).then((result) => {
    const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[]
    return outputs.flatMap((o) => o.output.map((chunk) => ('code' in chunk ? chunk.code : ''))).join('\n')
  })
  return bundle
}

export async function openAudioRenderer(): Promise<AudioRenderer> {
  const { chromium } = await import('playwright')
  const browser = await chromium
    .launch({ args: ['--autoplay-policy=no-user-gesture-required'] })
    .catch((cause: unknown) => {
      throw new Error(`the audio render needs headless Chromium and could not start it: ${String(cause)}`)
    })
  const page = await browser.newPage()
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('about:blank')
  await page.addScriptTag({ content: await pageBundle() })
  const call = async (name: string, args: readonly unknown[]): Promise<number[][]> => {
    try {
      return (await page.evaluate(
        ({ name, args }) =>
          (
            globalThis as unknown as Record<string, Record<string, (...a: unknown[]) => Promise<number[][]>>>
          ).__automataAudio?.[name]?.(...args) as Promise<number[][]>,
        { name, args },
      )) as number[][]
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause)
      // Playwright prefixes the page's message with its own; keep the page's.
      throw new Error(errors.length > 0 ? `${text}; page errors: ${errors.join('; ')}` : text)
    }
  }
  return {
    cue: (content, id, options) => call('cue', [content, id, options]),
    bed: (content, id, seconds) => call('bed', [content, id, seconds]),
    mix: (content, mix) => call('mix', [content, mix]),
    duck: (content, options) => call('duck', [content, options]),
    close: () => browser.close(),
  }
}
