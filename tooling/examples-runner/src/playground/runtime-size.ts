import { gzipSync } from 'node:zlib'

/** The playground runtime's JavaScript, gzip level 9, at most. */
export const RUNTIME_GZIP_BUDGET = 460_000

/** The gzip bytes of every JavaScript file under `runtime/`, one by one as a server sends them, against `budget`. */
export function checkRuntimeSize(
  files: readonly { readonly path: string; readonly bytes: Uint8Array }[],
  budget: number,
): { readonly gzipBytes: number; readonly budget: number; readonly ok: boolean } {
  let gzipBytes = 0
  for (const file of files)
    if (file.path.startsWith('runtime/') && file.path.endsWith('.js'))
      gzipBytes += gzipSync(file.bytes, { level: 9 }).length
  return { gzipBytes, budget, ok: gzipBytes <= budget }
}
