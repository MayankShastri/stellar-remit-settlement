import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { SectionLabel } from './Primitives'
import { CornerBrackets } from './CornerBrackets'
import { validateAmount } from '../lib/validate'

export function DonateForm({ address, withdrawn, isDonating, onDonate }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async event => {
    event.preventDefault()
    if (withdrawn) return
    const problem = validateAmount(amount)
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    const ok = await onDonate(amount.trim())
    if (ok) setAmount('')
  }

  const disabled = !address || isDonating || withdrawn

  return (
    <section className="relative rounded-md border border-zinc-800 bg-black p-8">
      <CornerBrackets />
      <div className="flex items-center justify-between gap-4">
        <SectionLabel index="02" title="Contribute to pool" />
        {withdrawn && (
          <span className="font-mono text-[11px] uppercase tracking-widest text-red-500">
            Settled · closed
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-6">
        <label
          htmlFor="donate-amount"
          className="font-mono text-xs uppercase tracking-[0.18rem] text-zinc-500"
        >
          Amount · XLM
        </label>
        <input
          id="donate-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="e.g. 25"
          value={amount}
          onChange={event => {
            setAmount(event.target.value)
            setError(null)
          }}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'donate-error' : undefined}
          className={`mt-2 min-h-[44px] w-full rounded-md border bg-zinc-950 px-4 py-3 font-mono text-sm text-white placeholder:text-zinc-600 transition-colors duration-150 hover:border-zinc-600 focus:border-zinc-600 focus:outline-none disabled:opacity-40 ${
            error ? 'border-red-500' : 'border-zinc-800'
          }`}
        />
        {error && (
          <p
            id="donate-error"
            role="alert"
            className="mt-2 flex items-center gap-2 font-mono text-xs text-red-500"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={disabled}
          className="mt-6 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition-colors duration-150 hover:bg-zinc-200 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isDonating && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          <span>{isDonating ? 'Signing…' : address ? 'Donate' : 'Connect wallet'}</span>
        </button>

        <p className="mt-4 font-mono text-[10px] uppercase tracking-widest text-zinc-600">
          Testnet only · funds settle through the locked Splitter contract
        </p>
      </form>
    </section>
  )
}
