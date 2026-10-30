// The two values render-pixi's renderer imports from @mcthaydt/automata-runtime, so the spike can mount through the
// real `createPixiRenderer` without bundling the runtime's Svelte panels (vite.config.ts aliases the runtime here).
// `RendererUnavailable` is the runtime's own class; `DEFAULT_QUALITY` is the runtime's value
// (packages/runtime/src/settings/display-settings.schema.ts).
export { RendererUnavailable } from '../../../../packages/runtime/src/boot/boot-error.ts'
export const DEFAULT_QUALITY = 'high' as const
