/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_RegionInputs */

const en_items_region = /** @type {(inputs: Items_RegionInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Items`)
};

/**
* | output |
* | --- |
* | "Items" |
*
* @param {Items_RegionInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_region = /** @type {((inputs?: Items_RegionInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_RegionInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_region(inputs)
});