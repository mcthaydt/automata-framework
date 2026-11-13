// Stands in for @af-examples/set-3d in the fixture build (scene-examples/vite.config.ts), which has no content compiler; kept out of that folder, where the runner would read it as an example.
export const scene = (options: { readonly start: string }) => ({ id: `scene-${options.start}` })
