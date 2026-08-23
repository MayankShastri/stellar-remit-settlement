import { usePool } from './hooks/usePool'
import { isConfigured } from './lib/config'
import { CanvasBackground } from './components/CanvasBackground'
import { Navbar } from './components/Navbar'
import { PoolHero } from './components/PoolHero'
import { BalanceCard } from './components/BalanceCard'
import { DonateForm } from './components/DonateForm'
import { EventStream } from './components/EventStream'
import { DonorList } from './components/DonorList'
import { WithdrawPanel } from './components/WithdrawPanel'
import { TxStatusBanner } from './components/TxStatusBanner'
import { Toast } from './components/Toast'

export default function App() {
  const pool = usePool()

  return (
    <div className="relative flex min-h-screen flex-col bg-black text-white antialiased selection:bg-white/20">
      <CanvasBackground />
      <a
        href="#console"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
      >
        Skip to content
      </a>

      <Navbar
        address={pool.address}
        onConnect={pool.handleConnect}
        onDisconnect={pool.handleDisconnect}
      />

      {!isConfigured && (
        <div className="border-b border-zinc-800 bg-zinc-950 px-4 py-3 text-center font-mono text-xs text-amber-500">
          CONTRACT NOT CONFIGURED — set VITE_CROWDFUND_ID / VITE_SPLITTER_ID (see .env.example)
        </div>
      )}

      <main className="relative z-10 flex-1">
        <PoolHero
          progressPercent={pool.progressPercent}
          total={pool.progress.total}
          goal={pool.progress.goal}
          loading={pool.loading}
          withdrawn={pool.withdrawn}
        />

        <section id="console" className="px-4 pb-8 pt-4">
          <div className="mx-auto max-w-6xl">
            <TxStatusBanner
              status={pool.txStatus}
              txHash={pool.txHash}
              error={pool.txError}
              onClose={pool.clearTxStatus}
            />

            {pool.loadError && pool.loadError !== 'missing-config' ? (
              <div className="rounded-md border border-red-500/40 p-8 text-center">
                <p className="font-mono text-xs uppercase tracking-[0.18rem] text-red-500">
                  Pool state unavailable
                </p>
                <p className="mx-auto mt-2 max-w-md font-mono text-xs leading-5 text-zinc-500">
                  {pool.loadError} — retrying automatically. If this persists,
                  the testnet RPC may be down.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-5 min-h-[44px] rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-zinc-200"
                >
                  Retry now
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-6">
                    <BalanceCard
                      address={pool.address}
                      balance={pool.balance}
                      onRefresh={pool.refreshBalance}
                    />
                    <DonateForm
                      address={pool.address}
                      withdrawn={pool.withdrawn}
                      isDonating={pool.isDonating}
                      onDonate={pool.handleDonate}
                    />
                  </div>
                  <div className="space-y-6">
                    <EventStream events={pool.eventLog} />
                    <DonorList
                      donors={pool.donors}
                      address={pool.address}
                      loading={pool.loading}
                    />
                  </div>
                </div>

                <WithdrawPanel
                  isAdmin={pool.isAdmin}
                  progress={pool.progress}
                  withdrawn={pool.withdrawn}
                  recipients={pool.recipients}
                  splitterLocked={null}
                  isWithdrawing={pool.isWithdrawing}
                  onWithdraw={pool.handleWithdraw}
                />
              </>
            )}
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-zinc-800 px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-md bg-white font-mono text-xs font-bold tracking-tighter text-black">
              SR
            </span>
            <p className="text-sm text-zinc-400">
              Stellar Remit · Orange Belt — cross-border group settlement
            </p>
          </div>
          <div className="flex gap-6 font-mono text-xs uppercase tracking-widest text-zinc-600">
            <a href="#console" className="transition-colors hover:text-white">Console</a>
            <a href="https://stellar.expert/explorer/testnet" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Explorer</a>
            <a href="https://developers.stellar.org" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Docs</a>
          </div>
        </div>
      </footer>

      <Toast toast={pool.toast} />
    </div>
  )
}
