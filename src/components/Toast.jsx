import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

const KINDS = {
  success: { icon: CheckCircle2, dot: 'bg-emerald-500' },
  error: { icon: AlertCircle, dot: 'bg-red-500' },
  info: { icon: Info, dot: 'bg-zinc-400' },
}

export function Toast({ toast }) {
  if (!toast) return null
  const kind = KINDS[toast.type] || KINDS.info
  const Icon = kind.icon

  return (
    <output
      className="animate-fadeUp fixed bottom-6 right-4 z-[90] flex max-w-sm items-start gap-3 rounded-md border border-zinc-800 bg-black p-4 shadow-sm sm:right-6"
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${kind.dot.replace('bg-', 'text-')}`} aria-hidden="true" />
      <p className="font-mono text-xs leading-5 text-zinc-300">{toast.message}</p>
    </output>
  )
}
