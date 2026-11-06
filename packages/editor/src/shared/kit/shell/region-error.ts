// What the shell's error panel shows and copies when a region's content throws (kit spec §6).

/** The regions `EditorShell` renders from a snippet, each inside its own error boundary. */
export type SnippetRegion = 'topbar' | 'rail' | 'panel' | 'canvas' | 'inspector' | 'dock' | 'status'

/** How the error panel names a region to the person using the editor. */
export const REGION_LABEL: Record<SnippetRegion, string> = {
  topbar: 'top bar',
  rail: 'section bar',
  panel: 'panel',
  canvas: 'canvas',
  inspector: 'inspector',
  dock: 'dock',
  status: 'status bar',
}

/** Plain text for a bug report: the region, the error, and its stack when it has one. */
export function regionErrorDetails(region: SnippetRegion, error: unknown): string {
  const lines = [`Region: ${region}`]
  if (error instanceof Error) {
    lines.push(`Error: ${error.name}: ${error.message}`)
    if (error.stack !== undefined && error.stack !== '') lines.push('', error.stack)
  } else {
    lines.push(`Error: ${String(error)}`)
  }
  return lines.join('\n')
}
