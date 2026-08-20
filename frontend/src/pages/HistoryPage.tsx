import { useMutation, useQuery } from '@apollo/client/react'
import { Link } from 'react-router-dom'
import { AGENT_RUNS_QUERY, DELETE_AGENT_RUN_MUTATION } from '../graphql'
import type { AgentRun } from '../types'

type Data = { agentRuns: AgentRun[] }

export function HistoryPage() {
  const { data, loading, error, refetch } = useQuery<Data>(AGENT_RUNS_QUERY, {
    variables: { limit: 30 },
    fetchPolicy: 'network-only',
  })
  const [deleteRun, { loading: deleting }] = useMutation(DELETE_AGENT_RUN_MUTATION)

  if (loading) return <p className="text-sm text-[var(--muted)]">Loading runs…</p>
  if (error) return <p className="text-sm text-red-700">{error.message}</p>

  const runs = data?.agentRuns ?? []

  async function onDelete(runId: number, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm(`Delete run #${runId}? This also removes linked eval scores.`)) {
      return
    }
    await deleteRun({ variables: { id: runId } })
    await refetch()
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Run history</h1>
        <p className="text-sm text-[var(--muted)]">
          Click a run to open full details, or delete runs you no longer need.
        </p>
      </header>

      {runs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          No runs yet.{' '}
          <Link className="text-[var(--accent)] underline" to="/">
            Run an agent
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {runs.map((run) => (
            <li
              key={run.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 transition hover:border-[var(--accent)] hover:shadow-sm"
            >
              <div className="mb-1 flex flex-wrap items-start justify-between gap-2">
                <Link to={`/history/${run.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">
                      #{run.id} · {run.recipeId}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">{run.inputText}</p>
                  <pre className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm">{run.outputText}</pre>
                  <p className="mt-2 text-xs text-[var(--accent)]">
                    Open full details → · {run.steps?.length ?? 0} steps ·{' '}
                    {run.steps?.reduce((n, s) => n + (s.toolCalls?.length ?? 0), 0) ?? 0}{' '}
                    tool calls
                  </p>
                </Link>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={(e) => onDelete(run.id, e)}
                  className="shrink-0 rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
