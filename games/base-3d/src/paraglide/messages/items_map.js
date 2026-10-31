/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_MapInputs */

const en_items_map = /** @type {(inputs: Items_MapInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Map`)
};

/**
* | output |
* | --- |
* | "Map" |
*
* @param {Items_MapInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_map = /** @type {((inputs?: Items_MapInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_MapInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_map(inputs)
});