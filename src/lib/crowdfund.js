import * as StellarSdk from '@stellar/stellar-sdk'
import * as SorobanRpc from '@stellar/stellar-sdk/rpc'
import { CROWDFUND_ID, NETWORK_PASSPHRASE, xlmToStroops } from './config'
import { server, simulateRead, describeSimulationError } from './rpc'

async function readNative(contractId, method, args) {
  const result = await simulateRead(contractId, method, args)
  const retval = result.result?.retval
  if (!retval) return null
  return StellarSdk.scValToNative(retval)
}

export async function getProgress() {
  const [total, goal] =
    (await readNative(CROWDFUND_ID, 'get_progress')) || [0, 0]
  return { total: BigInt(total), goal: BigInt(goal) }
}

export async function getDonors() {
  const parsed = await readNative(CROWDFUND_ID, 'get_donors')
  if (!Array.isArray(parsed)) return []
  return parsed.map(([address, amount]) => ({
    address,
    amount: BigInt(amount),
  }))
}

export async function getAdmin() {
  const parsed = await readNative(CROWDFUND_ID, 'get_admin')
  return parsed ? parsed.toString() : null
}

export async function getWithdrawn() {
  return Boolean(await readNative(CROWDFUND_ID, 'get_withdrawn'))
}

export async function getSplitterAddress() {
  const parsed = await readNative(CROWDFUND_ID, 'get_splitter')
  return parsed ? parsed.toString() : null
}

/** Build an unsigned donate transaction (donor signs it in their wallet). */
export function buildDonateTx(donor, amountXlm) {
  const amount = xlmToStroops(amountXlm)
  const account = new StellarSdk.Account(donor, '0')
  const contract = new StellarSdk.Contract(CROWDFUND_ID)
  return new StellarSdk.TransactionBuilder(account, {
    fee: '100000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'donate',
        StellarSdk.Address.fromString(donor).toScVal(),
        StellarSdk.nativeToScVal(amount, { type: 'i128' })
      )
    )
    .setTimeout(300)
    .build()
}

/** Build an unsigned withdraw transaction for the pool admin. */
export function buildWithdrawTx(admin) {
  const account = new StellarSdk.Account(admin, '0')
  const contract = new StellarSdk.Contract(CROWDFUND_ID)
  return new StellarSdk.TransactionBuilder(account, {
    fee: '300000', // cross-contract settlement burns more resources
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        'withdraw',
        StellarSdk.Address.fromString(admin).toScVal()
      )
    )
    .setTimeout(300)
    .build()
}

/**
 * Simulate first so contract-level failures surface BEFORE the wallet
 * prompt — the user never signs something that is destined to fail.
 */
export async function simulateOrThrow(tx) {
  const prepared = await server.prepareTransaction(tx)
  const simulation = await server.simulateTransaction(prepared)
  if (SorobanRpc.Api.isSimulationError(simulation)) {
    throw new Error(describeSimulationError(simulation))
  }
  return prepared
}

export async function submitSignedTx(signedXdr) {
  const tx = new StellarSdk.Transaction(signedXdr, NETWORK_PASSPHRASE)
  return server.sendTransaction(tx)
}

export async function pollTxResult(hash, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const result = await server.getTransaction(hash)
      if (result.status === 'SUCCESS' || result.status === 'FAILED') {
        return result
      }
    } catch {
      // not indexed yet — keep polling
    }
    await sleepFor(2000)
  }
  return null
}

function sleepFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
