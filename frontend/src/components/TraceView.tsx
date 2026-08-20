import type { TraceStep, ToolCall } from '../types'

function ScrollBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 font-semibold">{title}</div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded border border-[var(--line)] bg-white/80 p-2 text-xs">
        {text || '(empty)'}
      </pre>
    </div>
  )
}

function ToolCallBlock({ tc }: { tc: ToolCall }) {
  const full = tc.resultRaw || tc.resultSummary || ''
  return (
    <details open className="mb-2 rounded border border-[var(--line)] bg-[var(--accent-soft)]/40 p-2">
      <summary className="cursor-pointer text-sm font-medium text-[var(--accent)]">
        tool: {tc.name}
      </summary>
      <div className="mt-2 space-y-3 text-xs">
        <ScrollBlock title="arguments" text={tc.argumentsJson} />
        <ScrollBlock title="result (full)" text={full} />
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
            <pre className="mb-2 max-h-96 overflow-auto whitespace-pre-wrap break-words text-sm text-[var(--ink)]">
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
