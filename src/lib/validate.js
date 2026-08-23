const G_KEY_RE = /^G[A-Z2-7]{55}$/

/** Valid Stellar account address (G…, 56 chars, base32 alphabet). */
export function isValidAddress(address) {
  return typeof address === 'string' && G_KEY_RE.test(address)
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
