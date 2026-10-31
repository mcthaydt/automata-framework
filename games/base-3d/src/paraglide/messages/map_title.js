/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Map_TitleInputs */

const en_map_title = /** @type {(inputs: Map_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Map`)
};

/**
* | output |
* | --- |
* | "Map" |
*
* @param {Map_TitleInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const map_title = /** @type {((inputs?: Map_TitleInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Map_TitleInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_map_title(inputs)
});