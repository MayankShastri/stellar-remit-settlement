import { useState } from 'react'
import { Copy, Check, LogOut, Wallet } from 'lucide-react'
import { truncateAddress } from '../lib/config'

export function WalletConnect({ address, onConnect, onDisconnect }) {
  const [copied, setCopied] = useState(false)

  const copyAddress = () => {
    navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={copyAddress}
          title="Copy address"
          className="flex min-h-[44px] items-center gap-2 rounded-md border border-zinc-800 bg-black px-3 font-mono text-xs text-zinc-300 transition-colors duration-150 hover:border-zinc-600 hover:text-white"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {truncateAddress(address)}
        </button>
        <button
          onClick={onDisconnect}
          title="Disconnect"
          aria-label="Disconnect wallet"
          className="grid min-h-[44px] min-w-[44px] place-items-center rounded-md border border-zinc-800 text-zinc-400 transition-colors duration-150 hover:border-red-500 hover:text-red-500"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={onConnect}
      className="flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black transition-colors duration-150 hover:bg-zinc-200"
    >
      <Wallet className="h-4 w-4" aria-hidden="true" />
      Connect Wallet
    </button>
  )
}
