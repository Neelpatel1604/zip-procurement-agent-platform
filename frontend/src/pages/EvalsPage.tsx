import { useMemo } from 'react'
import { useQuery } from '@apollo/client/react'
import { EVAL_SCORES_QUERY } from '../graphql'
import type { EvalScore } from '../types'

type Data = { evalScores: EvalScore[] }

export function EvalsPage() {
  const { data, loading, error } = useQuery<Data>(EVAL_SCORES_QUERY, {
    variables: { limit: 50 },
    fetchPolicy: 'network-only',
  })

  const scores = data?.evalScores ?? []

  const byRecipe = useMemo(() => {
    const map = new Map<string, EvalScore[]>()
    for (const s of scores) {
      const key = s.recipeId || 'unknown'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    }
    return [...map.entries()]
  }, [scores])

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading eval scores…</p>
  if (error) return <p className="text-sm text-red-700">{error.message}</p>

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Eval dashboard</h1>
        <p className="text-sm text-[var(--muted)]">
          Scores from <code>run_evals.py</code> — deterministic checks + Claude-as-judge.
        </p>
      </header>

      {scores.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No eval_scores yet. From backend: <code>python scripts/run_evals.py</code>
        </p>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            {byRecipe.map(([recipeId, rows]) => {
              const latest = rows[0]
              const avg =
                rows.reduce((sum, r) => sum + r.score, 0) / Math.max(rows.length, 1)
              return (
                <div
                  key={recipeId}
                  className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4"
                >
                  <div className="text-sm text-[var(--muted)]">{recipeId}</div>
                  <div className="mt-1 text-2xl font-semibold">{avg.toFixed(2)}</div>
                  <div className="text-xs text-[var(--muted)]">
                    avg across {rows.length} scores · latest {latest.score.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </section>

          <div className="overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)]">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[var(--line)] bg-white/50 text-xs uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Recipe</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Run</th>
                  <th className="px-3 py-2">Reasoning</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--line)]/70 align-top">
                    <td className="px-3 py-2">{s.id}</td>
                    <td className="px-3 py-2">{s.recipeId}</td>
                    <td className="px-3 py-2 font-medium">{s.score.toFixed(3)}</td>
                    <td className="px-3 py-2">{s.runId}</td>
                    <td className="max-w-md px-3 py-2 text-[var(--muted)]">{s.reasoning}</td>
                    <td className="px-3 py-2 text-xs text-[var(--muted)]">
                      {new Date(s.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
