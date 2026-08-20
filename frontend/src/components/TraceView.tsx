import type { TraceStep } from '../types'

export function TraceView({ steps }: { steps: TraceStep[] }) {
  if (!steps?.length) {
    return <p className="text-sm text-[var(--muted)]">No trace steps.</p>
  }

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li
          key={step.iteration}
          className="rounded-lg border border-[var(--line)] bg-white/70 p-3"
        >
          <div className="mb-2 flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-semibold">Step {step.iteration}</span>
            {step.stopReason && (
              <span className="text-[var(--muted)]">stop: {step.stopReason}</span>
            )}
            {step.note && <span className="text-[var(--warn)]">{step.note}</span>}
          </div>
          {step.assistantText && (
            <pre className="mb-2 whitespace-pre-wrap text-sm text-[var(--ink)]">
              {step.assistantText}
            </pre>
          )}
          {step.toolCalls.map((tc) => (
            <details key={tc.id} className="mb-2 rounded border border-[var(--line)] bg-[var(--accent-soft)]/40 p-2">
              <summary className="cursor-pointer text-sm font-medium text-[var(--accent)]">
                tool: {tc.name}
              </summary>
              <div className="mt-2 space-y-2 text-xs">
                <div>
                  <div className="font-semibold">arguments</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap">{tc.argumentsJson}</pre>
                </div>
                <div>
                  <div className="font-semibold">result summary</div>
                  <pre className="overflow-x-auto whitespace-pre-wrap">{tc.resultSummary}</pre>
                </div>
              </div>
            </details>
          ))}
        </li>
      ))}
    </ol>
  )
}
