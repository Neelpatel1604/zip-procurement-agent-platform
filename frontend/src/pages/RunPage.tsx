import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { RECIPES_QUERY, CORRECT_RUN_MUTATION } from '../graphql'
import type { AgentRun, LiveProgressEvent, Recipe, TraceStep } from '../types'
import { TraceView } from '../components/TraceView'

type RecipesData = { recipes: Recipe[] }

const EXAMPLES: Record<string, string> = {
  duplicate_vendor_check:
    "New vendor request: name='Acme Corp LLC', domain='acme.com'. Should we onboard?",
  msa_risk_review:
    'Review MSA risk for CloudSync Analytics, especially liability and auto-renewal.',
}

function parseTraceSteps(traceJson: string | undefined): TraceStep[] {
  if (!traceJson) return []
  try {
    const trace = JSON.parse(traceJson)
    return (trace.steps || []).map((step: Record<string, unknown>) => ({
      iteration: Number(step.iteration || 0),
      stopReason: (step.stop_reason as string) || null,
      assistantText: (step.assistant_text as string) || '',
      note: (step.note as string) || null,
      toolCalls: ((step.tool_calls as Record<string, unknown>[]) || []).map((tc) => ({
        id: String(tc.id || ''),
        name: String(tc.name || ''),
        argumentsJson: JSON.stringify(tc.arguments ?? {}, null, 2),
        resultSummary: String(tc.result_summary || ''),
        resultRaw: String(tc.result_raw || tc.result_summary || ''),
      })),
    }))
  } catch {
    return []
  }
}

export function RunPage() {
  const { data: recipesData, loading: recipesLoading } = useQuery<RecipesData>(RECIPES_QUERY)
  const [recipeId, setRecipeId] = useState('duplicate_vendor_check')
  const [inputText, setInputText] = useState(EXAMPLES.duplicate_vendor_check)
  const [correctRun, { loading: correcting }] = useMutation(CORRECT_RUN_MUTATION)
  const [result, setResult] = useState<AgentRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [corrected, setCorrected] = useState('')
  const [correctMsg, setCorrectMsg] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [liveLog, setLiveLog] = useState<string[]>([])
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [liveSteps, setLiveSteps] = useState<TraceStep[]>([])

  const recipes = recipesData?.recipes ?? []
  const selected = useMemo(
    () => recipes.find((r) => r.id === recipeId),
    [recipes, recipeId],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCorrectMsg(null)
    setResult(null)
    setLiveLog([])
    setLiveSteps([])
    setLiveStatus('Starting…')
    setRunning(true)

    try {
      const res = await fetch('/api/runs/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId, inputText }),
      })
      if (!res.ok || !res.body) {
        throw new Error(`Stream failed: HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const line = part
            .split('\n')
            .map((l) => l.trim())
            .find((l) => l.startsWith('data:'))
          if (!line) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') continue

          let event: LiveProgressEvent
          try {
            event = JSON.parse(payload)
          } catch {
            continue
          }

          if (event.message) {
            setLiveStatus(event.message)
            setLiveLog((prev) => [...prev, event.message!])
          }

          if (event.type === 'tool_start' && event.tool) {
            setLiveSteps((prev) => {
              const iteration = event.iteration || prev.length || 1
              const existing = prev.find((s) => s.iteration === iteration)
              const toolCall = {
                id: `live-${iteration}-${event.tool}-${prev.length}`,
                name: event.tool!,
                argumentsJson: JSON.stringify(event.arguments ?? {}, null, 2),
                resultSummary: '(running…)',
                resultRaw: '(running…)',
              }
              if (!existing) {
                return [
                  ...prev,
                  {
                    iteration,
                    stopReason: 'tool_use',
                    assistantText: '',
                    toolCalls: [toolCall],
                  },
                ]
              }
              return prev.map((s) =>
                s.iteration === iteration
                  ? { ...s, toolCalls: [...s.toolCalls, toolCall] }
                  : s,
              )
            })
          }

          if (event.type === 'tool_end' && event.tool) {
            setLiveSteps((prev) =>
              prev.map((s) => {
                if (s.iteration !== (event.iteration || s.iteration)) return s
                const toolCalls = [...s.toolCalls]
                for (let i = toolCalls.length - 1; i >= 0; i -= 1) {
                  if (toolCalls[i].name === event.tool && toolCalls[i].resultRaw === '(running…)') {
                    toolCalls[i] = {
                      ...toolCalls[i],
                      resultSummary: String(event.result_raw || '').slice(0, 500),
                      resultRaw: String(event.result_raw || ''),
                      argumentsJson: JSON.stringify(event.arguments ?? {}, null, 2),
                    }
                    break
                  }
                }
                return { ...s, toolCalls }
              }),
            )
          }

          if (event.type === 'error') {
            throw new Error(event.error || event.message || 'Agent stream error')
          }

          if (event.type === 'run_complete') {
            const steps = parseTraceSteps(event.trace_json)
            const run: AgentRun = {
              id: event.run_id || 0,
              recipeId: event.recipe_id || recipeId,
              inputText: event.input_text || inputText,
              outputText: event.output_text || '',
              createdAt: event.created_at || new Date().toISOString(),
              steps,
              traceJson: event.trace_json,
            }
            setResult(run)
            setCorrected(run.outputText)
            setLiveSteps(steps)
            setLiveStatus(event.message || `Run #${run.id} complete.`)
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }

  async function onCorrect() {
    if (!result) return
    setCorrectMsg(null)
    try {
      const res = await correctRun({
        variables: {
          runId: result.id,
          correctedOutput: corrected,
        },
      })
      const item = (res.data as { correctRun?: { id: number; source: string } })?.correctRun
      setCorrectMsg(
        item
          ? `Added golden_set id=${item.id} (source=${item.source}). Next eval run will pick it up.`
          : 'Correction saved.',
      )
    } catch (err) {
      setCorrectMsg(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Run an agent</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Same engine, recipe-driven behavior. Live tool progress + full traces.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm"
      >
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Recipe</span>
          <select
            className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            value={recipeId}
            disabled={recipesLoading || running}
            onChange={(e) => {
              const id = e.target.value
              setRecipeId(id)
              if (EXAMPLES[id]) setInputText(EXAMPLES[id])
            }}
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.id})
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <p className="text-xs text-[var(--muted)]">
            tools: {selected.tools.join(', ')} · model: {selected.model || 'lambda default'}
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Request</span>
          <textarea
            className="min-h-28 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            value={inputText}
            disabled={running}
            onChange={(e) => setInputText(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={running || !inputText.trim()}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {running ? 'Running…' : 'Submit'}
        </button>
      </form>

      {(running || liveLog.length > 0) && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
          <h2 className="mb-2 text-lg font-semibold">Live activity</h2>
          {liveStatus && (
            <p className="mb-3 rounded-md bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent)]">
              {running ? '● ' : '✓ '}
              {liveStatus}
            </p>
          )}
          <ol className="max-h-48 space-y-1 overflow-auto text-xs text-[var(--muted)]">
            {liveLog.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))}
          </ol>
          {liveSteps.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold">Live trace</h3>
              <TraceView steps={liveSteps} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Output</h2>
              <span className="text-xs text-[var(--muted)]">run #{result.id}</span>
            </div>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-sm">
              {result.outputText}
            </pre>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <h2 className="mb-3 text-lg font-semibold">Execution trace</h2>
            <TraceView steps={result.steps} />
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
            <h2 className="mb-2 text-lg font-semibold">Correction loop</h2>
            <p className="mb-2 text-sm text-[var(--muted)]">
              Save a corrected output into the golden set (source=correction).
            </p>
            <textarea
              className="mb-2 min-h-24 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
              value={corrected}
              onChange={(e) => setCorrected(e.target.value)}
            />
            <button
              type="button"
              onClick={onCorrect}
              disabled={correcting || !corrected.trim()}
              className="rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)] disabled:opacity-50"
            >
              {correcting ? 'Saving…' : 'Add to golden set'}
            </button>
            {correctMsg && <p className="mt-2 text-sm">{correctMsg}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
