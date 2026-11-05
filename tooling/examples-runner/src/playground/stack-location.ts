// Where in the reader's code an error was thrown: the first stack frame in the
// example's module. V8 names a frame `at f (url:line:col)` or `at url:line:col`; JavaScriptCore and Gecko name it
// `f@url:line:col`. The module is a Blob URL, and V8 names it by the `//# sourceURL` the compile step appends, so a
// frame counts when its URL is that file or a `blob:` URL (the frame runs no other Blob module).

const FRAME = /(?:\(|@|^\s*at\s+)(\S+):(\d+):(\d+)\)?\s*$/

/** The 1-based line and column of the first frame of `stack` in `file` (its sourceURL) or the Blob module. */
export function exampleLocation(
  stack: string,
  file: string,
): { readonly line: number; readonly column: number } | undefined {
  for (const text of stack.split('\n')) {
    const match = FRAME.exec(text)
    if (match === null) continue
    const [, url = '', line = '', column = ''] = match
    if (url === file || url.endsWith(`/${file}`) || url.startsWith('blob:'))
      return { line: Number(line), column: Number(column) }
  }
  return undefined
}
