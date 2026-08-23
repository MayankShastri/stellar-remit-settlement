/**
 * Pure split calculation — mirrors the Splitter contract exactly:
 * every recipient except the last receives floor(amount × bps / 10_000),
 * and the last receives whatever remains, so integer rounding can never
 * trap dust in either contract.
 *
 * Kept in sync with contracts/splitter/src/lib.rs (distribute).
 */
export const BPS_TOTAL = 10_000

export function computeSplit(amountStroops, recipients) {
  if (!Number.isInteger(amountStroops) || amountStroops <= 0) {
    throw new Error('amount must be a positive integer (stroops)')
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('at least one recipient is required')
  }

  const totalBps = recipients.reduce((sum, r) => sum + r.bps, 0)
  if (totalBps !== BPS_TOTAL) {
    throw new Error(`shares must sum to ${BPS_TOTAL} bps, got ${totalBps}`)
  }

  let distributed = 0n
  return recipients.map((recipient, index) => {
    let share
    if (index === recipients.length - 1) {
      share = BigInt(amountStroops) - distributed
    } else {
      share = (BigInt(amountStroops) * BigInt(recipient.bps)) / BigInt(BPS_TOTAL)
      distributed += share
    }
    return { address: recipient.address, amount: share }
  })
}
