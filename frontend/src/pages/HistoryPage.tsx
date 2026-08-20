import { useQuery } from '@apollo/client/react'
import { Link } from 'react-router-dom'
import { AGENT_RUNS_QUERY } from '../graphql'
import type { AgentRun } from '../types'

type Data = { agentRuns: AgentRun[] }

export function HistoryPage() {
  const { data, loading, error } = useQuery<Data>(AGENT_RUNS_QUERY, {
    variables: { limit: 30 },
    fetchPolicy: 'network-only',
  })

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading runs…</p>
  if (error) return <p className="text-sm text-red-700">{error.message}</p>

  const runs = data?.agentRuns ?? []

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Run history</h1>
        <p className="text-sm text-[var(--muted)]">Persisted agent_runs from SQLite.</p>
      </header>

      {runs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No runs yet. <Link className="text-[var(--accent)] underline" to="/">Run an agent</Link>.
        </p>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => (
            <li
              key={run.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4"
            >
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  #{run.id} · {run.recipeId}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mb-2 line-clamp-2 text-sm text-[var(--muted)]">{run.inputText}</p>
              <pre className="line-clamp-4 whitespace-pre-wrap text-sm">{run.outputText}</pre>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {run.steps?.length ?? 0} trace steps ·{' '}
                {run.steps?.reduce((n, s) => n + (s.toolCalls?.length ?? 0), 0) ?? 0} tool calls
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
