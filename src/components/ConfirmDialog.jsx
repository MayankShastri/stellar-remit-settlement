import { useEffect, useRef } from 'react'

/**
 * Native <dialog> confirmation for the settlement — shows exactly where
 * every stroop will land before the admin signs. Escape closes it for free.
 */
export function ConfirmDialog({ open, totalStroops, shares, onCancel, onConfirm }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    // Backdrop dismissal: clicks on the <dialog> itself are outside the panel.
    const onClick = event => {
      if (event.target === dialog) onCancel()
    }
    dialog.addEventListener('click', onClick)
    return () => dialog.removeEventListener('click', onClick)
  }, [open, onCancel])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      aria-labelledby="confirm-title"
      className="m-auto rounded-md border border-zinc-800 bg-black p-8 backdrop:bg-black/80"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.18rem] text-zinc-500">
        Confirm settlement
      </p>
      <h3 id="confirm-title" className="mt-2 text-lg font-semibold tracking-tight text-white">
        Settle {Number(totalStroops) / 1e7} XLM now?
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-400">
        Both payments execute inside one transaction. If either transfer fails,
        the whole settlement reverts and the pool stays intact.
      </p>

      <ul className="mt-6 divide-y divide-zinc-800 border-y border-zinc-800">
        {shares.map((share, index) => (
          <li key={share.address} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-widest text-white">
                Recipient {String(index + 1).padStart(2, '0')} · {share.bpsLabel}
              </p>
              <p className="mt-0.5 break-all font-mono text-[11px] text-zinc-500">
                {share.address}
              </p>
            </div>
            <span className="whitespace-nowrap font-mono text-sm tabular-nums text-white">
              {Number(share.amount) / 1e7} XLM
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-[10px] leading-4 tracking-wide text-zinc-600">
        // SPLITTER ADDRESS WAS LOCKED AT INITIALIZE() — THIS DESTINATION CANNOT BE CHANGED
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          onClick={onCancel}
          className="min-h-[44px] rounded-full border border-zinc-700 px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-zinc-300 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          autoFocus
          className="min-h-[44px] rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-colors duration-150 hover:bg-zinc-200"
        >
          Sign & settle
        </button>
      </div>
    </dialog>
  )
}
