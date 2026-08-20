import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { RECIPES_QUERY, CORRECT_RUN_MUTATION } from '../graphql'
import type { AgentRun, LiveProgressEvent, Recipe, TraceStep } from '../types'
import { TraceView } from '../components/TraceView'
import { RecipeSelect } from '../components/RecipeSelect'
import { LiveProgress } from '../components/LiveProgress'

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
        className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5"
      >
        <RecipeSelect
          recipes={recipes}
          value={recipeId}
          loading={recipesLoading}
          disabled={running}
          onChange={(id) => {
            setRecipeId(id)
            if (EXAMPLES[id]) setInputText(EXAMPLES[id])
          }}
        />

        {selected && (
          <p className="text-xs text-[var(--muted)]">
            model: {selected.model || 'lambda default'}
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Request</span>
          <textarea
            className="min-h-28 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10"
            value={inputText}
            disabled={running}
            onChange={(e) => setInputText(e.target.value)}
          />
        </label>

        <button
          type="submit"
          disabled={running || !inputText.trim()}
          className="cursor-pointer rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
        >
          {running ? 'Running…' : 'Submit'}
        </button>
      </form>

      <LiveProgress
        running={running}
        status={liveStatus}
        recipeName={selected?.name}
        log={liveLog}
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {result && !running && (
        <section className="space-y-4">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold">Output</h2>
              <span className="text-xs text-[var(--muted)]">run #{result.id}</span>
            </div>
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
              {result.outputText}
            </pre>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <h2 className="mb-3 text-base font-semibold">Execution trace</h2>
            <TraceView steps={result.steps} />
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-5">
            <h2 className="mb-1 text-base font-semibold">Correction loop</h2>
            <p className="mb-3 text-sm text-[var(--muted)]">
              Save a corrected output into the golden set (source=correction).
            </p>
            <textarea
              className="mb-3 min-h-24 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/10"
              value={corrected}
              onChange={(e) => setCorrected(e.target.value)}
            />
            <button
              type="button"
              onClick={onCorrect}
              disabled={correcting || !corrected.trim()}
              className="cursor-pointer rounded-lg border border-[var(--line)] px-3.5 py-2 text-sm font-medium text-[var(--ink)] transition hover:bg-[var(--bg)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {correcting ? 'Saving…' : 'Add to golden set'}
            </button>
            {correctMsg && <p className="mt-2 text-sm text-[var(--muted)]">{correctMsg}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
