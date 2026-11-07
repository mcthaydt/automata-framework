import type { Filter, Renderer } from 'pixi.js'

/** Hears why a filter was left out. */
export type FilterDropped = (id: string, reason: string) => void

/**
 * Builds a filter, or returns `undefined` and reports why when it cannot be built or its GLSL does not link
 *: a part that cannot be built is absent instead of throwing out of the mount, and the frame draws
 * without it.
 *
 * Pixi 8 does not throw on a broken program: it logs the shader log and renders with an unusable program
 * (`render-quality.parity.test.ts` shows this in Chromium, WebKit and Firefox). So under WebGL2 the program is
 * compiled and linked here on the renderer's own context, once, before the filter is handed out. Under WebGPU only
 * a throw while building is caught: WGSL compile errors arrive asynchronously, after the frame.
 */
export function tryFilter<F extends Filter>(
  renderer: Renderer,
  id: string,
  make: () => F,
  dropped: FilterDropped,
): F | undefined {
  let filter: F
  try {
    filter = make()
  } catch (error) {
    dropped(id, error instanceof Error ? error.message : String(error))
    return undefined
  }
  const failure = glLinkFailure(renderer, filter)
  if (failure === undefined) return filter
  filter.destroy()
  dropped(id, failure)
  return undefined
}

/** The link log when the filter's GLSL program does not compile and link on a WebGL2 renderer, else `undefined`. */
function glLinkFailure(renderer: Renderer, filter: Filter): string | undefined {
  const gl = (renderer as { gl?: WebGL2RenderingContext }).gl
  const program = filter.glProgram
  if (!gl || !program) return undefined

  const shaders: WebGLShader[] = []
  const compile = (type: number, source: string | undefined): void => {
    if (source === undefined) return
    const shader = gl.createShader(type)
    if (!shader) return
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    shaders.push(shader)
  }
  compile(gl.VERTEX_SHADER, program.vertex)
  compile(gl.FRAGMENT_SHADER, program.fragment)

  const linked = gl.createProgram()
  for (const shader of shaders) gl.attachShader(linked, shader)
  gl.linkProgram(linked)
  const ok = gl.getProgramParameter(linked, gl.LINK_STATUS) === true
  const log = ok
    ? undefined
    : [gl.getProgramInfoLog(linked), ...shaders.map((shader) => gl.getShaderInfoLog(shader))]
        .filter((line): line is string => typeof line === 'string' && line.trim() !== '')
        .join('\n') || 'the program did not link'
  for (const shader of shaders) gl.deleteShader(shader)
  gl.deleteProgram(linked)
  return log
}
