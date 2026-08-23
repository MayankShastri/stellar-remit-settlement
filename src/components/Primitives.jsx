export function SectionLabel({ index, title }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-white/70" />
      <h2 className="font-mono text-xs font-semibold uppercase tracking-[0.18rem] text-zinc-400">
        {index} / {title}
      </h2>
    </div>
  )
}

export function Pill({ children, inverted = false, dot = null }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${
        inverted
          ? 'border-white bg-white text-black'
          : 'border-zinc-800 text-zinc-400'
      }`}
    >
      {dot && (
        <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      )}
      {children}
    </span>
  )
}
