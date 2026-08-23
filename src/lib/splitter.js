import * as StellarSdk from '@stellar/stellar-sdk'
import { SPLITTER_ID } from './config'
import { simulateRead } from './rpc'

export async function getRecipients() {
  const result = await simulateRead(SPLITTER_ID, 'get_recipients', [])
  const retval = result.result?.retval
  if (!retval) return []
  const parsed = StellarSdk.scValToNative(retval)
  return parsed.map(([address, bps]) => ({ address, bps }))
}

export async function getCrowdfundAddress() {
  const result = await simulateRead(SPLITTER_ID, 'get_crowdfund', [])
  const retval = result.result?.retval
  return retval ? StellarSdk.scValToNative(retval).toString() : null
}
