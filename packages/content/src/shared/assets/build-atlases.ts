// The atlas build. Reads `content/atlases.toml`, packs each atlas's folder of PNG frames
// with the deterministic packer, and returns the page images and Pixi's Spritesheet data, keyed by file name.
// Writing them is the caller's (the CLI's): the build itself never touches the outputs, so a check can run it.
//
// Every problem is a diagnostic, and all of them are reported together, as the compiler does: a broken frame,
// a frame too large for a page, and (only when the game declares `content/palette.toml`) an off-palette pixel.
// The default DUEL palette is the renderer's, not an authoring rule, so it is never checked here.
import { join } from 'node:path'
import { Effect } from 'effect'
import { ContentCompileFailed } from '../compile/errors'
import { type Diagnostic, sortDiagnostics } from '../diagnostics/diagnostic'
import { listFiles, readBytesIfPresent, readTextIfPresent } from '../files/content-files'
import { checkPalette, type Palette, paletteSchema } from '../palette/palette'
import { diagnosticAt, type ParsedToml, parseDocument } from '../parse/parse-document'
import { atlasPageFiles } from './asset-outputs'
import { composePage, decodePng, encodePng, type Rgba, spritesheetJson } from './atlas-image'
import { AtlasFrameTooLarge, packFrames } from './atlas-pack'
import { atlasesSchema } from './atlases.schema'
import { offPalettePixels } from './palette-pixels'

/** What `buildAtlases` produces; the caller writes it. */
export interface AtlasOutputs {
  /** `<atlas>-<page>.png` and `<atlas>-<page>.json`, sorted by name. */
  readonly files: ReadonlyMap<string, Uint8Array>
}

const ATLASES_FILE = 'content/atlases.toml'
const PALETTE_FILE = 'content/palette.toml'

const atFile = (file: string, code: Diagnostic['code'], message: string): Diagnostic => ({
  code,
  file,
  line: 1,
  column: 1,
  keyPath: '',
  message,
})

const reason = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause))

/**
 * Builds every atlas `<root>/content/atlases.toml` names, or fails with every problem found. Without the file
 * there is nothing to build.
 */
export const buildAtlases = (root: string): Effect.Effect<AtlasOutputs, ContentCompileFailed> =>
  Effect.gen(function* () {
    const diagnostics: Diagnostic[] = []
    const fail = () => Effect.fail(new ContentCompileFailed({ diagnostics: sortDiagnostics(diagnostics) }))

    /** A file's text or bytes, with a read failure reported as a diagnostic on that file. */
    const readText = (file: string) =>
      readTextIfPresent(join(root, file)).pipe(
        Effect.catchAll((error) => {
          diagnostics.push(atFile(file, 'missingAsset', `could not be read: ${reason(error.cause)}`))
          return Effect.succeed(undefined)
        }),
      )

    const atlasesText = yield* readText(ATLASES_FILE)
    if (atlasesText === undefined) {
      if (diagnostics.length > 0) return yield* fail()
      return { files: new Map() }
    }
    const atlases = parseDocument({ file: ATLASES_FILE, text: atlasesText }, atlasesSchema)
    if (!atlases.ok) {
      diagnostics.push(...atlases.diagnostics)
      return yield* fail()
    }

    const palette = yield* declaredPalette(yield* readText(PALETTE_FILE), diagnostics)

    const files = new Map<string, Uint8Array>()
    const names = Object.keys(atlases.value.atlas).sort()
    for (const name of names) {
      const folder = atlases.value.atlas[name]?.frames.replace(/\/+$/, '') ?? ''
      const reported = diagnostics.length
      const frames = yield* readFrames(root, folder, palette, diagnostics)
      // A refused frame is already reported, and a partial atlas is never packed: only a folder with no PNG
      // files at all is "no frames".
      if (frames === undefined || diagnostics.length > reported) continue
      if (frames.size === 0) {
        diagnostics.push(missingFrames(atlases.toml, name, folder))
        continue
      }
      packAtlas(name, folder, frames, files, diagnostics)
    }

    if (diagnostics.length > 0) return yield* fail()
    return { files: new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) }
  })

/** The game's declared palette, or undefined when it declares none or the declaration is broken. */
const declaredPalette = (text: string | undefined, diagnostics: Diagnostic[]) =>
  Effect.sync((): Palette | undefined => {
    if (text === undefined) return undefined
    const parsed = parseDocument({ file: PALETTE_FILE, text }, paletteSchema)
    if (!parsed.ok) {
      diagnostics.push(...parsed.diagnostics)
      return undefined
    }
    const { palette, problems } = checkPalette(parsed.value)
    for (const problem of problems)
      diagnostics.push(diagnosticAt(parsed.toml, problem.code, problem.path, problem.message))
    return palette
  })

/**
 * The PNG frames directly inside `folder`, by name (the file name without `.png`), decoded and, when there is a
 * palette, checked. Undefined when the folder could not be listed (already reported).
 */
const readFrames = (root: string, folder: string, palette: Palette | undefined, diagnostics: Diagnostic[]) =>
  Effect.gen(function* () {
    const listed = yield* Effect.either(listFiles(join(root, folder)))
    if (listed._tag === 'Left') {
      diagnostics.push(atFile(folder, 'missingAsset', `could not be read: ${reason(listed.left.cause)}`))
      return undefined
    }
    const frames = new Map<string, { readonly file: string; readonly image: Rgba }>()
    for (const entry of listed.right) {
      if (entry.includes('/') || !entry.endsWith('.png')) continue
      const file = `${folder}/${entry}`
      const bytes = yield* Effect.either(readBytesIfPresent(join(root, file)))
      if (bytes._tag === 'Left' || bytes.right === undefined) {
        const why = bytes._tag === 'Left' ? reason(bytes.left.cause) : 'it disappeared while building'
        diagnostics.push(atFile(file, 'invalidAsset', `could not be read: ${why}`))
        continue
      }
      let image: Rgba
      try {
        image = decodePng(bytes.right)
      } catch (error) {
        diagnostics.push(atFile(file, 'invalidAsset', `is not a PNG: ${reason(error)}`))
        continue
      }
      const stray = palette === undefined ? undefined : offPalettePixels(image, palette)
      if (stray !== undefined) {
        const { x, y, color } = stray.first
        const others = stray.count === 1 ? '' : ` (and ${stray.count - 1} more)`
        diagnostics.push(
          atFile(file, 'offPalette', `pixel ${x},${y} is ${color}, not a ${palette?.name} colour${others}`),
        )
        continue
      }
      frames.set(entry.slice(0, -'.png'.length), { file, image })
    }
    return frames
  })

const missingFrames = (toml: ParsedToml, name: string, folder: string): Diagnostic =>
  diagnosticAt(toml, 'missingAsset', ['atlas', name, 'frames'], `${folder} has no PNG frames`)

/** Packs one atlas and adds its pages to `files`, or reports the frame no page can hold. */
function packAtlas(
  name: string,
  folder: string,
  frames: ReadonlyMap<string, { readonly file: string; readonly image: Rgba }>,
  files: Map<string, Uint8Array>,
  diagnostics: Diagnostic[],
): void {
  const sizes = [...frames].map(([frame, { image }]) => ({
    name: frame,
    width: image.width,
    height: image.height,
  }))
  let packed: ReturnType<typeof packFrames>
  try {
    packed = packFrames(sizes)
  } catch (error) {
    if (!(error instanceof AtlasFrameTooLarge)) throw error
    diagnostics.push(atFile(`${folder}/${error.frame.name}.png`, 'invalidAsset', error.message))
    return
  }
  const images = new Map([...frames].map(([frame, { image }]) => [frame, image]))
  const encoder = new TextEncoder()
  packed.pageSizes.forEach((size, page) => {
    const placements = packed.placements.filter((placement) => placement.page === page)
    const { json, image } = atlasPageFiles(name, page)
    files.set(image, encodePng(composePage(size, placements, images)))
    files.set(json, encoder.encode(spritesheetJson(page, size, image, packed.placements)))
  })
}
