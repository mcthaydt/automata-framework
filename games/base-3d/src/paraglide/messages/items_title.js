/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Items_TitleInputs */

const en_items_title = /** @type {(inputs: Items_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Items`)
};

/**
* | output |
* | --- |
* | "Items" |
*
* @param {Items_TitleInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const items_title = /** @type {((inputs?: Items_TitleInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Items_TitleInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_items_title(inputs)
});