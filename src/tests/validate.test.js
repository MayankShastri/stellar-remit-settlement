import { describe, it, expect } from 'vitest'
import { isValidAddress, validateAmount } from '../lib/validate'

const VALID_KEY = 'GA5MY3FFEPCYIXKQBW7WGG6SV7G6MMDOQST3OG7AWPQUIJSVJ2QB6RS3'

describe('isValidAddress — Stellar G-key format', () => {
  it('accepts a well-formed 56-char G address', () => {
    expect(isValidAddress(VALID_KEY)).toBe(true)
  })

  it('rejects wrong length', () => {
    expect(isValidAddress(VALID_KEY.slice(0, 55))).toBe(false)
    expect(isValidAddress(VALID_KEY + 'A')).toBe(false)
  })

  it('rejects wrong version byte or alphabet violations', () => {
    expect(isValidAddress('C' + VALID_KEY.slice(1))).toBe(false)
    expect(isValidAddress(VALID_KEY.toLowerCase())).toBe(false)
    expect(isValidAddress(VALID_KEY.replace(/^.{5}/, '0Il1O'))).toBe(false) // non-base32 chars
  })

  it('rejects non-string input', () => {
    expect(isValidAddress(null)).toBe(false)
    expect(isValidAddress(undefined)).toBe(false)
    expect(isValidAddress(123)).toBe(false)
  })
})

describe('validateAmount — donation form', () => {
  it('requires a value', () => {
    expect(validateAmount('')).toMatch(/Enter a valid/)
    expect(validateAmount('   ')).toMatch(/Enter a valid/)
    expect(validateAmount(null)).toMatch(/Enter a valid/)
  })

  it('rejects text and symbols', () => {
    expect(validateAmount('abc')).toMatch(/Numbers only/)
    expect(validateAmount('10XLM')).toMatch(/Numbers only/)
    expect(validateAmount('$5')).toMatch(/Numbers only/)
  })

  it('rejects zero and negatives', () => {
    expect(validateAmount('0')).toMatch(/greater than zero/)
    expect(validateAmount('-5')).toMatch(/Numbers only|valid/)
    expect(validateAmount('1e5')).toMatch(/Numbers only/) // scientific notation not accepted
  })

  it('accepts plausible amounts with decimals', () => {
    expect(validateAmount('25')).toBeNull()
    expect(validateAmount('10.5')).toBeNull()
    expect(validateAmount('  42.25  ')).toBeNull()
  })

  it('enforces the wallet balance ceiling when provided', () => {
    expect(validateAmount('101', { max: 100 })).toMatch(/exceeds/)
    expect(validateAmount('99.9', { max: 100 })).toBeNull()
  })
})
