/** Which GPU/driver actually rendered: lets the verdict tell a real GPU from a software fallback. */
export async function gpuInfo(): Promise<{ webgpu: string | null; webgl: string | null }> {
  let webgpu: string | null = null
  const gpu = (
    navigator as Navigator & { gpu?: { requestAdapter(): Promise<{ info?: Record<string, string> } | null> } }
  ).gpu
  if (gpu) {
    const adapter = await gpu.requestAdapter()
    webgpu = adapter?.info
      ? `${adapter.info.vendor ?? ''} ${adapter.info.architecture ?? ''} ${adapter.info.description ?? ''}`.trim()
      : null
  }
  const gl = document.createElement('canvas').getContext('webgl2')
  const ext = gl?.getExtension('WEBGL_debug_renderer_info')
  const webgl =
    gl && ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : gl
        ? String(gl.getParameter(gl.RENDERER))
        : null
  return { webgpu, webgl }
}
