/**
 * Decorative corner brackets — top-left and bottom-right L-marks.
 * A locked-in part of the Stellar Remit design system (see design.md §5).
 */
export function CornerBrackets() {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-3.5 w-3.5 border-l border-t border-zinc-600"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 border-b border-r border-zinc-600"
      />
    </>
  )
}
