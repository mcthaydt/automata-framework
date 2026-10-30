import type { PlaygroundRuntime } from './frame-page.ts'

/** The playground build's entries, as Vite's manifest keys them (paths from tooling/examples-runner). */
export const PLAYGROUND_ENTRIES = {
  automata: 'playground/runtime/automata.ts',
  zod: 'playground/runtime/zod.ts',
  noEval: 'playground/runtime/no-eval.ts',
  frame: 'src/playground/frame.ts',
} as const

interface ManifestChunk {
  readonly file: string
  readonly imports?: readonly string[]
  readonly css?: readonly string[]
}

/**
 * Where the runtime's entries and stylesheets landed in a playground build, from its Vite manifest, under `base`
 * (the site path the build is served at). The stylesheets are those of the frame and the umbrella and every chunk
 * they import, in the order Vite lists them.
 */
export function runtimeFromViteManifest(
  manifest: Readonly<Record<string, ManifestChunk>>,
  base: string,
): PlaygroundRuntime {
  const entry = (name: keyof typeof PLAYGROUND_ENTRIES): ManifestChunk => {
    const chunk = manifest[PLAYGROUND_ENTRIES[name]]
    if (chunk === undefined)
      throw new Error(`the playground build has no ${name} entry (${PLAYGROUND_ENTRIES[name]})`)
    return chunk
  }
  const styles: string[] = []
  const seen = new Set<string>()
  const collect = (key: string, chunk: ManifestChunk | undefined) => {
    if (chunk === undefined || seen.has(key)) return
    seen.add(key)
    for (const css of chunk.css ?? []) if (!styles.includes(css)) styles.push(css)
    for (const imported of chunk.imports ?? []) collect(imported, manifest[imported])
  }
  const automata = entry('automata')
  const frame = entry('frame')
  const zod = entry('zod')
  const noEval = entry('noEval')
  collect(PLAYGROUND_ENTRIES.automata, automata)
  collect(PLAYGROUND_ENTRIES.frame, frame)
  return {
    automata: base + automata.file,
    zod: base + zod.file,
    noEval: base + noEval.file,
    frame: base + frame.file,
    styles: styles.map((css) => base + css),
  }
}
