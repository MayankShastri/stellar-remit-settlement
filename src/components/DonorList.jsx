import { SectionLabel } from './Primitives'
import { CornerBrackets } from './CornerBrackets'
import { formatXlm, truncateAddress } from '../lib/config'

export function DonorList({ donors, address, loading }) {
  return (
    <section className="relative rounded-md border border-zinc-800 bg-black p-8">
      <CornerBrackets />
      <div className="flex items-center justify-between gap-4">
        <SectionLabel index="04" title="Recent donors" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-600">
          {loading ? '—' : `${donors.length} total`}
        </span>
      </div>

      {loading ? (
        <ul className="mt-6 space-y-3">
          {[0, 1, 2].map(i => (
            <li key={i} className="h-9 animate-pulse rounded bg-zinc-900" />
          ))}
        </ul>
      ) : donors.length === 0 ? (
        <p className="mt-6 text-sm leading-6 text-zinc-500">
          No contributions yet — the pool is waiting for its first donor.
        </p>
      ) : (
        <ul className="mt-4 max-h-80 divide-y divide-zinc-800/70 overflow-y-auto">
          {donors.map((donor, index) => {
            const you = donor.address === address
            return (
              <li
                key={donor.address}
                className={`flex items-center justify-between gap-4 py-3 ${
                  you ? 'text-white' : ''
                }`}
              >
                <span
                  className={`flex min-w-0 items-baseline gap-3 font-mono text-xs ${
                    you ? 'text-white' : 'text-zinc-400'
                  }`}
                >
                  <span className="tabular-nums text-zinc-600">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="truncate">{truncateAddress(donor.address)}</span>
                  {you && (
                    <span className="rounded-full border border-emerald-500 px-2 py-px font-mono text-[10px] uppercase tracking-widest text-emerald-500">
                      You
                    </span>
                  )}
                </span>
                <span className="whitespace-nowrap font-mono text-xs tabular-nums text-white">
                  {formatXlm(donor.amount)} XLM
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
