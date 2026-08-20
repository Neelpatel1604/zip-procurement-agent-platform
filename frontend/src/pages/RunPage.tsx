import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import { RECIPES_QUERY, RUN_AGENT_MUTATION, CORRECT_RUN_MUTATION } from '../graphql'
import type { AgentRun, Recipe } from '../types'
import { TraceView } from '../components/TraceView'

type RecipesData = { recipes: Recipe[] }
type RunData = { runAgent: AgentRun }

const EXAMPLES: Record<string, string> = {
  duplicate_vendor_check:
    "New vendor request: name='Acme Corp LLC', domain='acme.com'. Should we onboard?",
  msa_risk_review:
    'Review MSA risk for CloudSync Analytics, especially liability and auto-renewal.',
}

export function RunPage() {
  const { data: recipesData, loading: recipesLoading } = useQuery<RecipesData>(RECIPES_QUERY)
  const [recipeId, setRecipeId] = useState('duplicate_vendor_check')
  const [inputText, setInputText] = useState(EXAMPLES.duplicate_vendor_check)
  const [runAgent, { loading: running }] = useMutation<RunData>(RUN_AGENT_MUTATION)
  const [correctRun, { loading: correcting }] = useMutation(CORRECT_RUN_MUTATION)
  const [result, setResult] = useState<AgentRun | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [corrected, setCorrected] = useState('')
  const [correctMsg, setCorrectMsg] = useState<string | null>(null)

  const recipes = recipesData?.recipes ?? []
  const selected = useMemo(
    () => recipes.find((r) => r.id === recipeId),
    [recipes, recipeId],
  )

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCorrectMsg(null)
    try {
      const res = await runAgent({
        variables: { recipeId, inputText },
      })
      const run = res.data?.runAgent
      if (run) {
        setResult(run)
        setCorrected(run.outputText)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
          Same engine, recipe-driven behavior. Traces show real Claude tool calls.
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
            disabled={recipesLoading}
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
            tools: {selected.tools.join(', ')} · model: {selected.model}
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-medium">Request</span>
          <textarea
            className="min-h-28 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2"
            value={inputText}
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
            <pre className="whitespace-pre-wrap text-sm">{result.outputText}</pre>
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
