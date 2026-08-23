import { formatXlm } from '../lib/config'
import { Pill } from './Primitives'

const STEPS = [
  { n: '01', label: 'Pool funds', done: null },
  { n: '02', label: 'Goal reached', done: null },
  { n: '03', label: 'Atomic 70/30 settlement', done: null },
]

export function PoolHero({ progressPercent, total, goal, loading, withdrawn }) {
  const goalMet = !loading && total >= goal && goal > 0n

  return (
    <section id="home" className="relative px-4 pt-16 pb-10 sm:pt-20">
      <div className="mx-auto max-w-3xl text-center">
        <Pill dot={withdrawn ? 'bg-emerald-500' : 'bg-white animate-pulse-subtle'}>
          {withdrawn ? 'Settled' : goalMet ? 'Goal reached' : 'Funding live'}
        </Pill>

        <h1 className="mt-6 text-5xl font-bold leading-[0.95] tracking-tighter text-white sm:text-6xl md:text-7xl">
          Group settlement,
          <br />
          enforced on-chain.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg">
          A community pools XLM toward a shared cross-border expense. On
          withdrawal, one transaction settles every obligation — no promises,
          just the contract.
        </p>

        {/* Progress */}
        <div className="mx-auto mt-12 max-w-md">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
              Pool progress
            </span>
            <span className="font-mono text-xs tabular-nums text-zinc-500">
              {loading ? '—' : `${Math.round(progressPercent)}%`}
            </span>
          </div>
          <progress
            value={Number(loading ? 0 : progress.total)}
            max={Number(progress.goal) || 1}
            aria-label="Funding progress toward the pool goal"
            className="h-2 w-full appearance-none overflow-hidden rounded-full border border-zinc-800 bg-zinc-950 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-white [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-zinc-950 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-white"
          />
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-mono text-sm font-medium tabular-nums text-white">
              {loading ? (
                <span className="inline-block h-4 w-24 animate-pulse rounded bg-zinc-800" />
              ) : (
                `${formatXlm(total)} XLM`
              )}
            </span>
            <span className="font-mono text-xs tabular-nums text-zinc-500">
              of {formatXlm(goal)} XLM
            </span>
          </div>
        </div>

        {/* Steps */}
        <div className="mx-auto mt-12 grid max-w-lg grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {STEPS.map(step => {
            const reached =
              step.n === '01' ||
              (step.n === '02' && goalMet) ||
              (step.n === '03' && withdrawn)
            return (
              <div
                key={step.n}
                className={`rounded-md border p-3 ${
                  reached ? 'border-zinc-600' : 'border-zinc-800'
                }`}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  Step {step.n}
                </p>
                <p
                  className={`mt-1 text-xs font-medium ${
                    reached ? 'text-white' : 'text-zinc-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
