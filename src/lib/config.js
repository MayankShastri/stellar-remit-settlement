export const RPC_URL =
  import.meta.env.VITE_RPC_URL || 'https://soroban-testnet.stellar.org'
export const HORIZON_URL =
  import.meta.env.VITE_HORIZON_URL || 'https://horizon-testnet.stellar.org'
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
export const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet'

export const CROWDFUND_ID = import.meta.env.VITE_CROWDFUND_ID || ''
export const SPLITTER_ID = import.meta.env.VITE_SPLITTER_ID || ''

/** True when both deployed contract addresses are configured. */
export const isConfigured = Boolean(CROWDFUND_ID && SPLITTER_ID)

const STROOPS_PER_XLM = 10_000_000n

/** stroops (BigInt) → XLM string with 2 decimals, e.g. 1007000000n → "100.70" */
export function stroopsToXlm(stroops) {
  const whole = stroops / STROOPS_PER_XLM
  const frac = (stroops % STROOPS_PER_XLM).toString().padStart(7, '0')
  return `${whole}.${frac.slice(0, 2)}`
}

/** XLM number/string → stroops BigInt */
export function xlmToStroops(xlm) {
  const value = typeof xlm === 'string' ? parseFloat(xlm) : xlm
  return BigInt(Math.round(value * Number(STROOPS_PER_XLM)))
}

/** Locale-grouped XLM amount for display, e.g. "10,070.00" */
export function formatXlm(stroops) {
  return Number(stroopsToXlm(stroops)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** GABC…WXYZ truncated address for display */
export function truncateAddress(address, head = 6, tail = 6) {
  if (!address) return ''
  if (address.length <= head + tail) return address
  return `${address.slice(0, head)}…${address.slice(-tail)}`
}

/** tx hash shortened for log rows */
export function shortHash(hash) {
  if (!hash) return '—'
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`
}
