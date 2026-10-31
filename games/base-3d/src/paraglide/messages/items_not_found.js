/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_Not_FoundInputs */

const en_items_not_found = /** @type {(inputs: Items_Not_FoundInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Not found yet`)
};

/**
* | output |
* | --- |
* | "Not found yet" |
*
* @param {Items_Not_FoundInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_not_found = /** @type {((inputs?: Items_Not_FoundInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_Not_FoundInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_not_found(inputs)
});