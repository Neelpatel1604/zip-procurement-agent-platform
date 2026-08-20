type Props = {
  running: boolean
  status: string | null
  recipeName?: string
  log: string[]
}

/** Quiet Zip-style status block: icon + title + grey progress line. */
export function LiveProgress({ running, status, recipeName, log }: Props) {
  if (!running && log.length === 0) return null

  const title = recipeName || 'Procurement agent'
  const line =
    status ||
    (running ? 'Working…' : 'Complete')

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white px-5 py-5">
      <div className="flex items-start gap-3.5">
        <div
          className="mt-0.5 h-8 w-8 shrink-0 rounded-full"
          style={{
            background:
              'linear-gradient(180deg, #b8c7e8 0%, #e8c4b0 100%)',
          }}
          aria-hidden
        />
        <div className="min-w-0 pt-0.5">
          <div className="text-[13px] font-medium text-[#3f3f46]">
            {title}
          </div>
          <div
            className={`mt-1 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-[#8b8b93] ${
              running ? 'status-pulse' : ''
            }`}
          >
            {line}
          </div>
        </div>
      </div>

      {log.length > 1 && (
        <ul className="mt-4 max-h-36 space-y-1.5 overflow-auto border-t border-[var(--line)] pt-3">
          {log.slice(0, -1).map((entry, i) => (
            <li key={`${i}-${entry.slice(0, 24)}`} className="text-xs text-[#a1a1aa]">
              {entry}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
