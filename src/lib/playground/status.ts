// The status line's texts (spec §8.3) that the page shows before the orchestrator, and its Zod schemas, have loaded.

export const STATUS = {
  starting: 'Starting the preview…',
  running: 'Running. Edit the code and the preview updates as you type.',
  updated: 'Preview updated.',
  bootTimeout: 'The preview did not start within 10 seconds.',
  firstBootTimeout: 'The preview couldn’t load. Check the connection and press Play to try again.',
  kept: 'The preview is still running your last working version.',
  loadingEditor: 'Loading the editor…',
  editorFailed: 'The editor couldn’t load. The code is shown read-only, and Play still runs the original.',
} as const
