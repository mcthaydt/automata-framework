import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
import type { Plugin } from 'vite'

export const EFFECT_BUDGET_BYTES = 35_000

export interface EffectShareResult {
  readonly rawBytes: number
  readonly gzipBytes: number
  readonly moduleCount: number
  readonly modules: readonly string[]
}

export function isEffectModule(id: string): boolean {
  return id.includes('/node_modules/effect/') || id.includes('effect@3.22.2')
}

/**
 * Traverses an output bundle, filters for Effect runtime modules,
 * concatenates their rendered code, and calculates raw and gzip sizes (spec §9).
 */
export function computeEffectShare(bundle: Record<string, unknown>): EffectShareResult {
  const modules: string[] = []
  let combinedCode = ''

  for (const item of Object.values(bundle)) {
    if (
      item &&
      typeof item === 'object' &&
      'type' in item &&
      item.type === 'chunk' &&
      'modules' in item &&
      item.modules &&
      typeof item.modules === 'object'
    ) {
      for (const [id, mod] of Object.entries(item.modules as Record<string, { code?: string }>)) {
        if (isEffectModule(id)) {
          modules.push(id)
          combinedCode += (mod?.code ?? '') + '\n'
        }
      }
    }
  }

  const rawBytes = combinedCode.length
  const gzipBytes = gzipSync(Buffer.from(combinedCode, 'utf8'), { level: 9 }).length

  return {
    rawBytes,
    gzipBytes,
    moduleCount: modules.length,
    modules,
  }
}

/**
 * Checks whether the measured gzip bytes meet the E1 budget.
 */
export function checkEffectShare(
  gzipBytes: number,
  budgetBytes: number = EFFECT_BUDGET_BYTES,
): { readonly ok: boolean; readonly message: string } {
  if (gzipBytes > budgetBytes) {
    return {
      ok: false,
      message: `Effect share ${gzipBytes} bytes gzip exceeds budget of ${budgetBytes} bytes (${((gzipBytes - budgetBytes) / 1000).toFixed(2)} kB over)`,
    }
  }
  return {
    ok: true,
    message: `Effect share ${gzipBytes} bytes gzip within budget of ${budgetBytes} bytes`,
  }
}

export interface EffectSharePluginOptions {
  readonly outDir?: string
  readonly budgetBytes?: number
}

/**
 * Vite plugin that computes Effect share during generateBundle and writes
 * dist/effect-share.json (Task 19).
 */
export function effectSharePlugin(options?: EffectSharePluginOptions): Plugin {
  return {
    name: 'af-effect-share',
    generateBundle(_opts, bundle) {
      const result = computeEffectShare(bundle)
      const outDir = options?.outDir ?? 'dist'
      const budgetBytes = options?.budgetBytes ?? EFFECT_BUDGET_BYTES
      const jsonPath = resolve(outDir, 'effect-share.json')

      mkdirSync(dirname(jsonPath), { recursive: true })
      writeFileSync(
        jsonPath,
        JSON.stringify(
          {
            rawBytes: result.rawBytes,
            gzipBytes: result.gzipBytes,
            budgetBytes,
            moduleCount: result.moduleCount,
            modules: result.modules,
          },
          null,
          2,
        ),
      )
    },
  }
}

// CLI runner: `node budget/effect-share.ts --check`
const isMain =
  process.argv[1] &&
  (import.meta.url === pathToFileURL(resolve(process.argv[1])).href ||
    process.argv[1].endsWith('effect-share.ts'))

if (isMain) {
  const jsonPath = resolve(process.cwd(), 'dist/effect-share.json')
  if (!existsSync(jsonPath)) {
    console.error(`Error: ${jsonPath} not found. Run 'vite build' first.`)
    process.exit(1)
  }

  const data = JSON.parse(readFileSync(jsonPath, 'utf8'))
  const budget = Number(process.env.EFFECT_SHARE_BUDGET ?? data.budgetBytes ?? EFFECT_BUDGET_BYTES)
  const result = checkEffectShare(data.gzipBytes, budget)

  console.log(
    `Effect share: ${(data.rawBytes / 1000).toFixed(2)} kB raw, ${(data.gzipBytes / 1000).toFixed(2)} kB gzip (${data.moduleCount} modules)`,
  )
  console.log(result.message)

  const isCheck = process.argv.includes('--check')
  if (isCheck && !result.ok) {
    if (process.env.EFFECT_SHARE_ALLOW_OVERFLOW === '1') {
      console.warn('Notice: EFFECT_SHARE_ALLOW_OVERFLOW=1 set; proceeding despite budget breach.')
    } else {
      process.exit(1)
    }
  }
}
