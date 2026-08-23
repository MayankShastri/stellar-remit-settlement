import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info, Loader2, ExternalLink } from 'lucide-react'
import { shortHash, EXPLORER_BASE } from '../lib/config'

const STYLES = {
  success: { icon: CheckCircle2, color: 'text-emerald-500', border: 'border-emerald-500/40' },
  error: { icon: XCircle, color: 'text-red-500', border: 'border-red-500/40' },
  pending: { icon: Loader2, color: 'text-white', border: 'border-zinc-600' },
  info: { icon: Info, color: 'text-zinc-300', border: 'border-zinc-800' },
}

/**
 * Tri-state transaction banner. Pending/success/error with explorer link;
 * dismissible via the close button or the Escape key.
 */
export function TxStatusBanner({ status, txHash, error, onClose }) {
  useEffect(() => {
    if (!status) return
    const onKey = event => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [status, onClose])

  if (!status) return null
  const style = STYLES[status] || STYLES.info
  const Icon = style.icon

  return (
    <output
      className={`animate-slideDown mb-8 flex flex-wrap items-start gap-4 rounded-md border bg-black p-5 ${style.border}`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${style.color} ${status === 'pending' ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.18rem] text-white">
          {status === 'pending'
            ? 'Transaction in flight'
            : status === 'success'
              ? 'Settled on-chain'
              : status === 'error'
                ? 'Transaction failed'
                : 'Heads up'}
        </p>
        {txHash ? (
          <a
            href={`${EXPLORER_BASE}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-zinc-500 hover:text-white"
          >
            {shortHash(txHash)} <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
          </a>
        ) : error ? (
          <p className="mt-1 font-mono text-xs leading-5 text-zinc-500">{error}</p>
        ) : (
          <p className="mt-1 font-mono text-xs text-zinc-500">
            Waiting for confirmation…
          </p>
        )}
      </div>
      {status !== 'pending' && (
        <button
          onClick={onClose}
          aria-label="Dismiss"
          className="grid size-9 place-items-center rounded-md font-mono text-xs text-zinc-600 transition-colors hover:text-white"
        >
          ✕
        </button>
      )}
    </output>
  )
}
