/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Hud_MapInputs */

const en_hud_map = /** @type {(inputs: Hud_MapInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Map`)
};

/**
* | output |
* | --- |
* | "Map" |
*
* @param {Hud_MapInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const hud_map = /** @type {((inputs?: Hud_MapInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Hud_MapInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_hud_map(inputs)
});