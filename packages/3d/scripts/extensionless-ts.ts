// Lets Node's type stripping load workspace packages whose sources import without a file extension (a relative
// `./preload-list` for `./preload-list.ts`, `./features` for `./features/index.ts`). Load it first:
//
//   node --import ./packages/3d/scripts/extensionless-ts.ts packages/3d/scripts/record-goldens.ts
//
// A specifier that already resolves is left alone; only a relative one that does not is retried with `.ts`, then
// `/index.ts`.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (!specifier.startsWith('.') || (error as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND')
        throw error
      try {
        return nextResolve(`${specifier}.ts`, context)
      } catch {
        return nextResolve(`${specifier}/index.ts`, context)
      }
    }
  },
})
