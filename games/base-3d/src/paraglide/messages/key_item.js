/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Key_ItemInputs */

const en_key_item = /** @type {(inputs: Key_ItemInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Item`)
};

/**
* | output |
* | --- |
* | "Item" |
*
* @param {Key_ItemInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const key_item = /** @type {((inputs?: Key_ItemInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Key_ItemInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_key_item(inputs)
});