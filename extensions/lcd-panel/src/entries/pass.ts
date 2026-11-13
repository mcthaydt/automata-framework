// @automata/lcd-panel/pass: the panel as a `PostEffect` and the call that adds it to core's look, and its mesh as a screen
// filter for the renderer's `postFilters`. Loads `@pixi/3d`.
export { addLcdPanelPass, LCD_PANEL_PASS, type LcdPanelOptions } from '../app/add-lcd-panel.ts'
export { LCD_SCREEN_FILTER, lcdPanelScreenFilter } from '../app/lcd-screen-filter.ts'
export { LcdPanelEffect } from '../features/lcd-panel/lcd-effect.ts'
