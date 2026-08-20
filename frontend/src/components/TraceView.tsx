import type { TraceStep, ToolCall } from '../types'

function ScrollBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {title}
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2.5 text-xs text-[var(--ink)]">
        {text || '(empty)'}
      </pre>
    </div>
  )
}

function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const full = tc.resultRaw || tc.resultSummary || ''
  const running = full === '(running…)'
  return (
    <details className="mb-2 rounded-lg border border-[var(--line)] bg-[var(--panel)]">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium text-[var(--ink)]">{tc.name}</span>
          <span className="text-xs text-[var(--muted)]">{running ? 'running' : 'done'}</span>
        </span>
      </summary>
      <div className="space-y-3 border-t border-[var(--line)] px-3 py-3">
        <ScrollBlock title="arguments" text={tc.argumentsJson} />
        <ScrollBlock title="result" text={full} />
      </div>
    </details>
  )
}

export function TraceView({ steps }: { steps: TraceStep[] }) {
  if (!steps?.length) {
    return <p className="text-sm text-[var(--muted)]">No trace steps.</p>
  }

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.iteration} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5">
          <div className="mb-2 flex flex-wrap items-baseline gap-2 text-sm">
            <span className="font-semibold text-[var(--ink)]">Step {step.iteration}</span>
            {step.stopReason && (
              <span className="text-xs text-[var(--muted)]">{step.stopReason}</span>
            )}
            {step.note && <span className="text-xs text-[var(--muted)]">{step.note}</span>}
          </div>
          {step.assistantText && (
            <pre className="mb-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-sm text-[var(--ink)]">
              {step.assistantText}
            </pre>
          )}
          {step.toolCalls.map((tc) => (
            <ToolCallBlock key={tc.id || `${step.iteration}-${tc.name}`} tc={tc} />
          ))}
        </li>
      ))}
    </ol>
  )
}
