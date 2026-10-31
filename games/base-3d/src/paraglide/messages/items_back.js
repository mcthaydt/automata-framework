/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_BackInputs */

const en_items_back = /** @type {(inputs: Items_BackInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Back`)
};

/**
* | output |
* | --- |
* | "Back" |
*
* @param {Items_BackInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_back = /** @type {((inputs?: Items_BackInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_BackInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_back(inputs)
});