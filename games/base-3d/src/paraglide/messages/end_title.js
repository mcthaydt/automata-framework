/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} End_TitleInputs */

const en_end_title = /** @type {(inputs: End_TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The ember is yours`)
};

/**
* | output |
* | --- |
* | "The ember is yours" |
*
* @param {End_TitleInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const end_title = /** @type {((inputs?: End_TitleInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<End_TitleInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_end_title(inputs)
});