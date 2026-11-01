/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} TitleInputs */

const en_title = /** @type {(inputs: TitleInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Ember Hall`)
};

/**
* | output |
* | --- |
* | "Ember Hall" |
*
* @param {TitleInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const title = /** @type {((inputs?: TitleInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<TitleInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_title(inputs)
});