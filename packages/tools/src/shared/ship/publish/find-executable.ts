import { accessSync, constants, statSync } from 'node:fs'
import { delimiter, join } from 'node:path'

// Where a program would be found on PATH, looked up on disk so `publish --target itch` can say butler is
// missing before it starts any process.

const WINDOWS_EXTENSIONS = ['.exe', '.cmd', '.bat', '']

function isExecutableFile(path: string): boolean {
  if (statSync(path, { throwIfNoEntry: false })?.isFile() !== true) return false
  try {
    accessSync(path, constants.X_OK) // on Windows this only checks that the file exists
    return true
  } catch {
    return false
  }
}

/** The first `name` on `pathEnv` that is an executable file, or undefined. Windows also tries .exe, .cmd, .bat. */
export function findExecutable(
  name: string,
  pathEnv: string = process.env.PATH ?? '',
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const extensions = platform === 'win32' ? WINDOWS_EXTENSIONS : ['']
  for (const folder of pathEnv.split(platform === 'win32' ? ';' : delimiter)) {
    if (folder === '') continue
    for (const extension of extensions) {
      const candidate = join(folder, `${name}${extension}`)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  return undefined
}
