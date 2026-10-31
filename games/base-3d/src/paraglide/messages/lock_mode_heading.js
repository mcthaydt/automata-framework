/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Lock_Mode_HeadingInputs */

const en_lock_mode_heading = /** @type {(inputs: Lock_Mode_HeadingInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Game`)
};

/**
* | output |
* | --- |
* | "Game" |
*
* @param {Lock_Mode_HeadingInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const lock_mode_heading = /** @type {((inputs?: Lock_Mode_HeadingInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Lock_Mode_HeadingInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_lock_mode_heading(inputs)
});