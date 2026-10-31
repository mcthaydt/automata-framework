/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_Small_KeysInputs */

const en_items_small_keys = /** @type {(inputs: Items_Small_KeysInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Small keys`)
};

/**
* | output |
* | --- |
* | "Small keys" |
*
* @param {Items_Small_KeysInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_small_keys = /** @type {((inputs?: Items_Small_KeysInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_Small_KeysInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_small_keys(inputs)
});