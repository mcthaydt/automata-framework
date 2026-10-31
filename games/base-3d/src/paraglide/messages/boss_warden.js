/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Boss_WardenInputs */

const en_boss_warden = /** @type {(inputs: Boss_WardenInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`The Ashen Warden`)
};

/**
* | output |
* | --- |
* | "The Ashen Warden" |
*
* @param {Boss_WardenInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const boss_warden = /** @type {((inputs?: Boss_WardenInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Boss_WardenInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_boss_warden(inputs)
});