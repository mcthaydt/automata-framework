/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Game_Over_TitleInputs */

const en_game_over_title = /** @type {(inputs: Game_Over_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The flame went out`)
};

/**
* | output |
* | --- |
* | "The flame went out" |
*
* @param {Game_Over_TitleInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const game_over_title = /** @type {((inputs?: Game_Over_TitleInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Game_Over_TitleInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_game_over_title(inputs)
});