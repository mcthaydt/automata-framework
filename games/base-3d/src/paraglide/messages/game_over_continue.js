/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Game_Over_ContinueInputs */

const en_game_over_continue = /** @type {(inputs: Game_Over_ContinueInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Continue`)
};

/**
* | output |
* | --- |
* | "Continue" |
*
* @param {Game_Over_ContinueInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const game_over_continue = /** @type {((inputs?: Game_Over_ContinueInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Game_Over_ContinueInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_game_over_continue(inputs)
});