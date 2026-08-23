import { useState, useEffect, useCallback, useRef } from 'react'
import * as StellarSdk from '@stellar/stellar-sdk'
import {
  initWalletKit,
  connectWallet,
  getActiveAddress,
  onWalletChange,
  disconnectWallet,
  signTransaction,
  describeError,
  isWalletRejection,
} from '../lib/wallet'
import {
  getProgress,
  getDonors,
  getAdmin,
  getWithdrawn,
  buildDonateTx,
  buildWithdrawTx,
  simulateOrThrow,
  submitSignedTx,
  pollTxResult,
} from '../lib/crowdfund'
import { getRecipients } from '../lib/splitter'
import { createEventPoller } from '../lib/events'
import { withRetry, describeTransactionResult } from '../lib/rpc'
import { HORIZON_URL, isConfigured } from '../lib/config'
import { validateAmount } from '../lib/validate'

export function usePool() {
  const [address, setAddress] = useState(null)
  const [balance, setBalance] = useState(null)
  const [admin, setAdmin] = useState(null)
  const [progress, setProgress] = useState({ total: 0n, goal: 0n })
  const [withdrawn, setWithdrawn] = useState(false)
  const [donors, setDonors] = useState([])
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [isDonating, setIsDonating] = useState(false)
  const [isWithdrawing, setIsWithdrawing] = useState(false)
  const [txStatus, setTxStatus] = useState(null) // pending | success | error
  const [txHash, setTxHash] = useState(null)
  const [txError, setTxError] = useState(null)
  const [toast, setToast] = useState(null)
  const [eventLog, setEventLog] = useState([])

  const pollerRef = useRef(null)
  const toastTimer = useRef(null)

  // ---- wallet ----
  useEffect(() => {
    initWalletKit()
    getActiveAddress().then(addr => addr && setAddress(addr))
    const unsub = onWalletChange(addr => setAddress(addr))
    return () => typeof unsub === 'function' && unsub()
  }, [])

  // ---- balance ----
  const refreshBalance = useCallback(async addr => {
    // Yield first: state updates below must never run synchronously
    // inside the effect/render cycle (React Compiler rule).
    await Promise.resolve()
    if (!addr) {
      setBalance(null)
      return
    }
    try {
      const account = await withRetry(() =>
        new StellarSdk.Horizon.Server(HORIZON_URL).loadAccount(addr)
      )
      const native = account.balances.find(b => b.asset_type === 'native')
      setBalance(native ? parseFloat(native.balance) : 0)
    } catch {
      setBalance(null)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refreshBalance(address)
  }, [address, refreshBalance])

  // ---- campaign state ----
  const refreshCampaign = useCallback(async () => {
    await Promise.resolve()
    if (!isConfigured) {
      setLoading(false)
      setLoadError('missing-config')
      return
    }
    try {
      const [progressData, donorsData, adminAddr, withdrawnFlag, recipientList] =
        await Promise.all([
          getProgress(),
          getDonors(),
          getAdmin(),
          getWithdrawn(),
          getRecipients(),
        ])
      setProgress(progressData)
      setDonors(donorsData.sort((a, b) => (b.amount > a.amount ? 1 : -1)))
      setAdmin(adminAddr)
      setWithdrawn(withdrawnFlag)
      setRecipients(recipientList)
      setLoadError(null)
    } catch (err) {
      console.error('Failed to load campaign state:', err)
      setLoadError(err?.message || 'Failed to load pool state')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refreshCampaign()
  }, [refreshCampaign])

  // ---- adaptive event polling ----
  useEffect(() => {
    if (!isConfigured) return
    const poller = createEventPoller({
      onBatch: events => {
        if (events.length === 0) return
        setEventLog(prev => {
          const seen = new Set(prev.map(e => e.id))
          const fresh = events.filter(e => !seen.has(e.id))
          return [...fresh, ...prev].slice(0, 30)
        })
        refreshCampaign()
      },
    })
    pollerRef.current = poller
    poller.start()
    const onVisible = () => document.hidden || poller.start()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      poller.stop()
    }
  }, [refreshCampaign])

  // ---- actions ----
  const handleConnect = useCallback(async () => {
    try {
      const addr = await connectWallet()
      setAddress(addr)
    } catch (err) {
      if (err?.code !== -1) showToast('error', describeError(err).message)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectWallet()
    } catch {
      /* ignore */
    }
    setAddress(null)
  }, [])

  const runTx = useCallback(
    async ({ buildTx, action }) => {
      setIsBusy(action, true)
      setTxStatus('pending')
      setTxHash(null)
      setTxError(null)
      try {
        const builtTx = await buildTx()
        const prepared = await simulateOrThrow(builtTx)
        let signed
        try {
          signed = await signTransaction(prepared.toXDR(), address)
        } catch (err) {
          // Signing is the only step where "rejected" means the user
          // declined — network errors later carry their own real reason.
          if (isWalletRejection(err)) {
            throw Object.assign(new Error('Transaction rejected — nothing was signed.'), {
              kind: 'rejected',
            })
          }
          throw err
        }
        // Kit modules return { signedTxXdr } (older builds: { signedXdr }).
        const signedXdr = signed?.signedTxXdr ?? signed?.signedXdr
        const sendResult = await submitSignedTx(signedXdr)
        setTxHash(sendResult.hash)
        if (sendResult.status === 'ERROR') {
          console.error('[submit] full RPC response:', sendResult)
          throw new Error(describeTransactionResult(sendResult.errorResultXdr))
        }
        const result = await pollTxResult(sendResult.hash)
        if (result?.status === 'SUCCESS') {
          setTxStatus('success')
          await refreshCampaign()
          await refreshBalance(address)
          return sendResult.hash
        }
        if (result?.status === 'FAILED') {
          throw new Error(describeTransactionResult(result.resultXdr))
        }
        throw new Error('Confirmation timed out — check the hash on the explorer.')
      } finally {
        setIsBusy(action, false)
      }
    },
    [address, refreshCampaign, refreshBalance]
  )

  const handleDonate = useCallback(
    async amountXlm => {
      if (!address) return showToast('error', 'Connect a wallet first.')
      const validationError = validateAmount(amountXlm)
      if (validationError) return showToast('error', validationError)

      setIsDonating(true)
      setTxStatus('pending')
      setTxHash(null)
      setTxError(null)
      try {
        const hash = await runTx({
          action: 'donate',
          buildTx: () => buildDonateTx(address, amountXlm),
        })
        setTxStatus('success')
        showToast('success', `Contribution of ${amountXlm} XLM confirmed.`)
        return hash
      } catch (err) {
        setTxStatus('error')
        const described = err?.kind
          ? { kind: err.kind, message: err.message }
          : describeError(err)
        setTxError(described.message)
        showToast(described.kind === 'rejected' ? 'info' : 'error', described.message)
      } finally {
        setIsDonating(false)
      }
    },
    [address, runTx]
  )

  const handleWithdraw = useCallback(async () => {
    if (!address) return showToast('error', 'Connect a wallet first.')
    if (address !== admin) return showToast('error', 'Only the pool admin can settle.')
    if (withdrawn) return showToast('error', 'Pool already settled.')

    setIsWithdrawing(true)
    setTxStatus('pending')
    setTxHash(null)
    setTxError(null)
    try {
      const hash = await runTx({
        action: 'withdraw',
        buildTx: () => buildWithdrawTx(address),
      })
      setTxStatus('success')
      showToast('success', 'Settlement complete â€” funds split atomically.')
      return hash
    } catch (err) {
      setTxStatus('error')
      const described = err?.kind
        ? { kind: err.kind, message: err.message }
        : describeError(err)
      setTxError(described.message)
      showToast('error', described.message)
    } finally {
      setIsWithdrawing(false)
    }
  }, [address, admin, withdrawn, runTx])

  function setIsBusy(action, value) {
    if (action === 'donate') setIsDonating(value)
    if (action === 'withdraw') setIsWithdrawing(value)
  }

  function showToast(type, message) {
    clearTimeout(toastTimer.current)
    setToast({ type, message })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  const clearTxStatus = useCallback(() => {
    setTxStatus(null)
    setTxHash(null)
    setTxError(null)
  }, [])

  const progressPercent =
    progress.goal > 0n
      ? Math.min(100, Number((progress.total * 10000n) / progress.goal) / 100)
      : 0

  return {
    address,
    balance,
    admin,
    progress,
    withdrawn,
    donors,
    recipients,
    loading,
    loadError,
    isDonating,
    isWithdrawing,
    txStatus,
    txHash,
    txError,
    toast,
    eventLog,
    isAdmin: Boolean(address && admin && address === admin),
    progressPercent,
    handleConnect,
    handleDisconnect,
    handleDonate,
    handleWithdraw,
    clearTxStatus,
    showToast,
    refreshBalance: () => refreshBalance(address),
  }
}
