import { useState } from 'react'
import { Lock, Loader2, XOctagon, CheckCircle2 } from 'lucide-react'
import { SectionLabel, Pill } from './Primitives'
import { CornerBrackets } from './CornerBrackets'
import { ConfirmDialog } from './ConfirmDialog'
import { computeSplit } from '../lib/split'
import { formatXlm, truncateAddress, SPLITTER_ID } from '../lib/config'

export function WithdrawPanel({
  isAdmin,
  progress,
  withdrawn,
  recipients,
  splitterLocked,
  isWithdrawing,
  onWithdraw,
}) {
  const [confirming, setConfirming] = useState(false)
  const goalMet = progress.total >= progress.goal && progress.goal > 0n
  const canWithdraw = isAdmin && goalMet && !withdrawn

  let shares = null
  if (recipients.length > 0 && progress.total > 0n) {
    try {
      const computed = computeSplit(Number(progress.total), recipients)
      shares = computed.map((share, i) => ({
        ...share,
        bpsLabel: `${recipients[i].bps} BPS`,
      }))
    } catch {
      shares = null // invalid config surfaces as an error state instead of a crash
    }
  }

  return (
    <section className="relative rounded-md border border-zinc-800 bg-black p-8">
      <CornerBrackets />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionLabel index="05" title="Withdraw & split" />
        <Pill inverted={withdrawn} dot={withdrawn ? null : 'bg-white animate-pulse-subtle'}>
          {withdrawn ? 'Settled' : goalMet ? 'Ready to settle' : 'Awaiting goal'}
        </Pill>
      </div>

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18rem] text-zinc-500">
            Pool balance · locked for settlement
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums tracking-tighter text-white sm:text-4xl">
            {formatXlm(progress.total)} XLM
          </p>
        </div>
        {!withdrawn && (
          <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">
            Checks → Effects → Interactions
          </p>
        )}
      </div>

      {/* Recipients preview — mirrors contract remainder-to-last logic */}
      {shares ? (
        <ul className="mt-8 divide-y divide-zinc-800/70 border-y border-zinc-800">
          {shares.map(share => (
            <li key={share.address} className="flex items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-widest text-white">
                  Recipient · {share.bpsLabel}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] text-zinc-500">
                  {truncateAddress(share.address)}
                </p>
              </div>
              <span className="whitespace-nowrap font-mono text-sm tabular-nums text-white">
                {formatXlm(share.amount)} XLM
              </span>
            </li>
          ))}
        </ul>
      ) : (
        !withdrawn && (
          <p className="mt-6 text-sm leading-6 text-zinc-500">
            Recipient table loads from the Splitter once contributions exist.
          </p>
        )
      )}

      {/* Action / state row */}
      {withdrawn ? (
        <div className="mt-8 rounded-md border border-zinc-800 p-5">
          <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-emerald-500">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Pool settled
          </p>
          <p className="mt-2 flex items-start gap-2 font-mono text-[11px] leading-5 text-zinc-500">
            <XOctagon className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            DONATE() AFTER WITHDRAWN IS REJECTED ON-CHAIN — LATE FUNDS ARE REFUSED,
            NEVER TRAPPED.
          </p>
        </div>
      ) : canWithdraw ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={isWithdrawing}
          className="mt-8 flex min-h-[44px] w-full min-w-[220px] items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-colors duration-150 hover:bg-zinc-200 active:translate-y-px disabled:opacity-40 sm:w-auto"
        >
          {isWithdrawing && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isWithdrawing ? 'Settling…' : 'Withdraw & settle'}
        </button>
      ) : (
        <p className="mt-8 flex items-center gap-2 font-mono text-xs text-amber-500">
          <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {isAdmin
            ? 'Withdrawal unlocks when the pool reaches its goal.'
            : 'Only the pool admin can trigger settlement.'}
        </p>
      )}

      {/* Contract facts */}
      <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-zinc-800 bg-zinc-800 sm:grid-cols-3">
        <Fact label="Splitter · locked at init" value={truncateAddress(splitterLocked || SPLITTER_ID)} pill="Verified" />
        <Fact label="Authorized caller" value="Crowdfund only" pill="Enforced" />
        <Fact label="Rounding" value="Remainder to last · zero dust" pill="Exact" />
      </dl>

      {confirming && shares && (
        <ConfirmDialog
          open
          totalStroops={progress.total}
          shares={shares}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onWithdraw()
          }}
        />
      )}
    </section>
  )
}

function Fact({ label, value, pill }) {
  return (
    <div className="bg-black p-4">
      <dt className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">{label}</dt>
      <dd className="mt-1.5 break-all font-mono text-[11px] text-zinc-300">{value}</dd>
      <dd className="mt-2">
        <Pill>{pill}</Pill>
      </dd>
    </div>
  )
}
