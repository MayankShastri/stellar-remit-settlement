import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit'
import { FreighterModule } from '@creit.tech/stellar-wallets-kit/modules/freighter'
import { LobstrModule } from '@creit.tech/stellar-wallets-kit/modules/lobstr'
import { AlbedoModule } from '@creit.tech/stellar-wallets-kit/modules/albedo'
import { HanaModule } from '@creit.tech/stellar-wallets-kit/modules/hana'
import { NETWORK_PASSPHRASE } from './config'

let initialized = false

export function initWalletKit() {
  if (initialized) return
  StellarWalletsKit.init({
    selectedWalletId: undefined,
    network: NETWORK_PASSPHRASE,
    modules: [
      new FreighterModule(),
      new LobstrModule(),
      new AlbedoModule(),
      new HanaModule(),
    ],
  })
  initialized = true
}

export async function connectWallet() {
  const { address } = await StellarWalletsKit.authModal()
  return address
}

export function getActiveAddress() {
  return StellarWalletsKit.getAddress()
    .then(r => r.address)
    .catch(() => null)
}

export async function signTransaction(xdr, address) {
  return StellarWalletsKit.signTransaction(xdr, {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
}

export function onWalletChange(callback) {
  return StellarWalletsKit.on('STATE_UPDATE', event => {
    callback(event.payload?.address || null)
  })
}

export async function disconnectWallet() {
  return StellarWalletsKit.disconnect()
}

/** Map a raw wallet/RPC error into a user-facing message. */
export function describeError(err) {
  const msg = String(err?.message || err || '')
  if (
    /reject|denied|cancel|declined/i.test(msg) ||
    err?.code === -1 ||
    err?.code === -3
  ) {
    return { kind: 'rejected', message: 'Transaction rejected — nothing was signed.' }
  }
  if (/no wallet|not installed|wallet not found|freighter.*not/i.test(msg)) {
    return { kind: 'wallet', message: 'No wallet detected — install a Stellar wallet to continue.' }
  }
  return { kind: 'generic', message: msg || 'Something went wrong.' }
}
