// `content/atlases.toml`: each atlas by name, and the folder of PNG frames it packs.
//
//   [atlas.wick]
//   frames = "art/wick"   # relative to the project root
import { z } from 'zod'

export interface AtlasesFile {
  readonly atlas: Readonly<Record<string, { readonly frames: string }>>
}

export const atlasesSchema: z.ZodType<AtlasesFile> = z.strictObject({
  atlas: z.record(
    z.string().regex(/^[a-z0-9-]+$/, 'atlases are named like wick or ui-icons'),
    z.strictObject({ frames: z.string().min(1) }),
  ),
})
