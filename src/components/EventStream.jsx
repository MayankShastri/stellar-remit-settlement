import { ExternalLink, Radio } from 'lucide-react'
import { SectionLabel } from './Primitives'
import { CornerBrackets } from './CornerBrackets'
import { shortHash, EXPLORER_BASE, formatXlm } from '../lib/config'

const LABELS = {
  DONATION: 'DONATION_RECEIVED',
  WITHDRAWN: 'WITHDRAW_TRIGGERED',
  PAYDIST: 'PAYMENT_DISTRIBUTED',
  OTHER: 'CONTRACT_EVENT',
}

export function EventStream({ events }) {
  return (
    <section className="relative rounded-md border border-zinc-800 bg-black p-8">
      <CornerBrackets />
      <div className="flex items-center justify-between gap-4">
        <SectionLabel index="03" title="Transaction log" />
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-emerald-500">
          <Radio className="h-3 w-3 animate-pulse-subtle" aria-hidden="true" />
          Live
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-6 text-sm leading-6 text-zinc-500">
          Streaming contract events… contributions and settlements appear here
          without a refresh.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-800/70">
          {events.slice(0, 12).map(event => {
            const label = LABELS[event.type] || LABELS.OTHER
            return (
              <li key={event.id} className="animate-fadeIn py-3 first:pt-1 last:pb-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p
                      className={`font-mono text-xs tracking-wider ${
                        event.type === 'PAYDIST' || event.type === 'WITHDRAWN'
                          ? 'text-emerald-500'
                          : 'text-zinc-400'
                      }`}
                    >
                      {label}
                    </p>
                    <a
                      href={`${EXPLORER_BASE}/tx/${event.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-flex items-center gap-1 font-mono text-[11px] text-zinc-600 hover:text-white"
                    >
                      {shortHash(event.txHash)}
                      <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                    </a>
                  </div>
                  {event.amountStroops != null && (
                    <span className="whitespace-nowrap font-mono text-xs tabular-nums text-white">
                      {formatXlm(event.amountStroops)} XLM
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
