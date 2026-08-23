import { WalletConnect } from './WalletConnect'
import { Pill } from './Primitives'

export function Navbar({ address, onConnect, onDisconnect }) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5"
        aria-label="Primary navigation"
      >
        <a href="#home" className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-md bg-white font-mono text-xs font-bold tracking-tighter text-black"
          >
            SR
          </span>
          <span className="text-sm font-semibold tracking-tight text-white">
            Stellar Remit
          </span>
          <Pill>Testnet</Pill>
        </a>
        <WalletConnect address={address} onConnect={onConnect} onDisconnect={onDisconnect} />
      </nav>
    </header>
  )
}
