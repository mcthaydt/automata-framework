/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Map_PlanInputs */

const en_map_plan = /** @type {(inputs: Map_PlanInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Map of the area: Wick’s arrow and the camera’s view`)
};

/**
* | output |
* | --- |
* | "Map of the area: Wick’s arrow and the camera’s view" |
*
* @param {Map_PlanInputs} inputs
* @param {{ locale?: "en" }} options
* @returns {LocalizedString}
*/
export const map_plan = /** @type {((inputs?: Map_PlanInputs, options?: { locale?: "en" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Map_PlanInputs, { locale?: "en" }, {}>} */ ((inputs = {}, options = {}) => {
	experimentalStaticLocale ?? options.locale ?? getLocale()
	return en_map_plan(inputs)
});