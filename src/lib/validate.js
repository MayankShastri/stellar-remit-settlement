import * as StellarSdk from '@stellar/stellar-sdk'

const G_KEY_RE = /^G[A-Z2-7]{55}$/

/**
 * Valid Stellar account address: 56 chars, base32 alphabet, AND a valid
 * StrKey checksum (catches transposed characters, not just format typos).
 */
export function isValidAddress(address) {
  if (typeof address !== 'string' || !G_KEY_RE.test(address)) return false
  try {
    return StellarSdk.StrKey.isValidEd25519PublicKey(address)
  } catch {
    return false
  }
}

/**
 * Validate a donation amount string.
 * Returns an error message, or null when the input is acceptable.
 */
export function validateAmount(raw, { max } = {}) {
  const value = String(raw ?? '').trim()
  if (value === '') return 'Enter a valid amount'
  if (!/^\d*(\.\d*)?$/.test(value)) return 'Numbers only — no symbols or text'
  const num = Number(value)
  if (!Number.isFinite(num)) return 'Enter a valid amount'
  if (num <= 0) return 'Amount must be greater than zero'
  if (max !== undefined && num > max) {
    return `Amount exceeds available balance (${max} XLM)`
  }
  return null
}
