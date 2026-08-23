import { describe, it, expect } from 'vitest'
import { computeSplit, BPS_TOTAL } from '../lib/split'

const BENEFICIARY = 'GA5MY3FFEPCYIXKQBW7WGG6SV7G6MMDOQST3OG7AWPQUIJSVJ2QB6RS3'
const PROVIDER = 'GCYTJWL4I5WQPE3ID7VUHEF4WHVIOAGXF6DPW75BI2EPMDARNT4K43FY'

const SEVENTY_THIRTY = [
  { address: BENEFICIARY, bps: 7000 },
  { address: PROVIDER, bps: 3000 },
]

describe('computeSplit — mirrors the Splitter contract', () => {
  it('splits an exact 70/30 pool with no dust', () => {
    // 100 XLM = 1_000_000_000 stroops
    const result = computeSplit(1_000_000_000, SEVENTY_THIRTY)
    expect(result[0]).toEqual({ address: BENEFICIARY, amount: 700_000_000n })
    expect(result[1]).toEqual({ address: PROVIDER, amount: 300_000_000n })
    expect(result.reduce((sum, r) => sum + r.amount, 0n)).toBe(1_000_000_000n)
  })

  it('gives the rounding remainder to the last recipient', () => {
    // 10_005 stroops at 50/50: floor(5002.5) = 5002, last takes the rest.
    const evenShares = [
      { address: BENEFICIARY, bps: 5000 },
      { address: PROVIDER, bps: 5000 },
    ]
    const result = computeSplit(10_005, evenShares)
    expect(result[0].amount).toBe(5002n)
    expect(result[1].amount).toBe(5003n) // dust lands here, nowhere is trapped
    expect(result.reduce((sum, r) => sum + r.amount, 0n)).toBe(10_005n)
  })

  it('handles a lopsided split with dust on the first share', () => {
    const shares = [
      { address: BENEFICIARY, bps: 3333 },
      { address: PROVIDER, bps: 6667 },
    ]
    const result = computeSplit(999_999, shares)
    expect(result[0].amount).toBe(333_299n) // floor(999999 × 3333 / 10000)
    expect(result.reduce((sum, r) => sum + r.amount, 0n)).toBe(999_999n)
  })

  it('settles everything to one recipient when configured alone', () => {
    const sole = [{ address: PROVIDER, bps: BPS_TOTAL }]
    const result = computeSplit(123_456_789, sole)
    expect(result.length).toBe(1)
    expect(result[0].amount).toBe(123_456_789n)
  })

  it('rejects share tables that do not sum to 10_000 bps', () => {
    const bad = [
      { address: BENEFICIARY, bps: 6000 },
      { address: PROVIDER, bps: 3000 },
    ]
    expect(() => computeSplit(1_000, bad)).toThrow(/must sum/)
  })

  it('rejects empty recipient tables and invalid amounts', () => {
    expect(() => computeSplit(1_000, [])).toThrow(/recipient/)
    expect(() => computeSplit(0, SEVENTY_THIRTY)).toThrow(/positive/)
    expect(() => computeSplit(-5, SEVENTY_THIRTY)).toThrow(/positive/)
    expect(() => computeSplit(1.5, SEVENTY_THIRTY)).toThrow(/integer/)
  })
})
