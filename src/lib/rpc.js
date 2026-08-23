import * as StellarSdk from '@stellar/stellar-sdk'
import * as SorobanRpc from '@stellar/stellar-sdk/rpc'
import { NETWORK_PASSPHRASE, RPC_URL } from './config'

export const server = new SorobanRpc.Server(RPC_URL, { allowHttp: false })

// Soroban read calls need a funded source account for sequence numbers;
// this well-known dead account is the standard stand-in.
const DEAD_ACCOUNT =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF'

function buildReadOp(contractId, method, args = []) {
  const account = new StellarSdk.Account(DEAD_ACCOUNT, '0')
  const contract = new StellarSdk.Contract(contractId)
  return new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build()
}

/** Simulate a read-only contract call with retries. */
export async function simulateRead(contractId, method, args = []) {
  return withRetry(async () => {
    const tx = buildReadOp(contractId, method, args)
    const result = await server.simulateTransaction(tx)
    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(describeSimulationError(result))
    }
    return result
  })
}

/**
 * Retry an async RPC read with exponential backoff + jitter.
 * Public testnet endpoints rate-limit and blip; retries are cheap insurance.
 */
export async function withRetry(fn, { attempts = 3, baseDelayMs = 400 } = {}) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (i < attempts - 1) {
        const delay = baseDelayMs * 2 ** i + Math.random() * 150
        await sleep(delay)
      }
    }
  }
  throw lastError
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Extract a friendly message from a Soroban simulation error.
 * Contract errors arrive as `Error(Contract, #n)` — map n to the enum value
 * declared in the contract's #[contracterror] enums.
 */
export const CONTRACT_ERROR_NAMES = {
  // CrowdfundError
  1: 'Already initialized',
  2: 'Contract not initialized',
  3: 'Amount must be greater than zero',
  4: 'Goal not reached yet',
  5: 'Only the pool admin can do that',
  6: 'Pool already settled — late contributions are rejected',
  // SplitterError (5 = unauthorized distribute caller)
  7: 'Unauthorized settlement caller',
}

export function describeSimulationError(result) {
  const raw = String(result?.error || '')
  const match = raw.match(/Error\(Contract, #(\d+)\)/)
  if (match) {
    return CONTRACT_ERROR_NAMES[Number(match[1])] || `Contract error #${match[1]}`
  }
  if (/nonexistent|not found|MissingValue/i.test(raw)) {
    return 'Contract state not found — is the pool initialized?'
  }
  return 'Simulation failed before signing — nothing left your wallet.'
}
