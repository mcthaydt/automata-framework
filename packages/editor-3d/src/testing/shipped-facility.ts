// The shipped `facility.json` (recorded from The Last Light at 92e6704) as the model the codec reads, for the tests of
// everything that works on a facility.
import type { Facility } from '../format/facility.schema'
import { facilityCodec } from '../profile/last-light-codecs'
import { loadFixture } from './fixtures'

export const shippedFacilityText: string = loadFixture('facility')

export const shippedFacility: Facility = (() => {
  const result = facilityCodec.parse(shippedFacilityText)
  if (!result.ok) throw new Error('the shipped facility does not parse')
  return result.value
})()
