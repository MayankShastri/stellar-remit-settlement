import { RefreshCw, ExternalLink, Droplets } from 'lucide-react'
import { SectionLabel } from './Primitives'
import { CornerBrackets } from './CornerBrackets'
import { EXPLORER_BASE } from '../lib/config'

export function BalanceCard({ address, balance, onRefresh }) {
  return (
    <section className="relative rounded-md border border-zinc-800 bg-black p-8">
      <CornerBrackets />
      <div className="flex items-center justify-between gap-4">
        <SectionLabel index="01" title="Account balance" />
        <button
          onClick={onRefresh}
          aria-label="Refresh balance"
          title="Refresh"
          className="grid size-9 place-items-center rounded-md text-zinc-500 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {address ? (
        <>
          <p className="mt-6 font-mono text-5xl font-bold tabular-nums tracking-tighter text-white sm:text-6xl">
            {balance === null ? (
              <span className="inline-block h-12 w-40 animate-pulse rounded bg-zinc-800" />
            ) : (
              balance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            )}
          </p>
          <p className="mt-1 font-mono text-xs uppercase tracking-widest text-zinc-500">
            XLM · Stellar Testnet
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <a
              href={`${EXPLORER_BASE}/account/${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-300 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
            >
              Explorer <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href="https://laboratory.stellar.org/#account-creator?network=test"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-zinc-800 px-4 py-2 font-mono text-xs uppercase tracking-widest text-zinc-500 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
            >
              Friendbot fund <Droplets className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </>
      ) : (
        <p className="mt-6 text-sm leading-6 text-zinc-500">
          Connect a wallet to see your testnet balance.
        </p>
      )}
    </section>
  )
}
