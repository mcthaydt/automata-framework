/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Item_SlingInputs */

const en_item_sling = /** @type {(inputs: Item_SlingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Spark Sling`)
};

/**
* | output |
* | --- |
* | "Spark Sling" |
*
* @param {Item_SlingInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const item_sling = /** @type {((inputs?: Item_SlingInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Item_SlingInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_item_sling(inputs)
});