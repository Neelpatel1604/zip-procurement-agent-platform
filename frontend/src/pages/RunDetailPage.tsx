import { useMutation, useQuery } from '@apollo/client/react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AGENT_RUN_QUERY, CORRECT_RUN_MUTATION, DELETE_AGENT_RUN_MUTATION } from '../graphql'
import type { AgentRun } from '../types'
import { TraceView } from '../components/TraceView'
import { useState } from 'react'

type Data = { agentRun: AgentRun | null }

export function RunDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const runId = Number(id)
  const { data, loading, error } = useQuery<Data>(AGENT_RUN_QUERY, {
    variables: { id: runId },
    skip: !Number.isFinite(runId),
    fetchPolicy: 'network-only',
  })
  const [correctRun, { loading: correcting }] = useMutation(CORRECT_RUN_MUTATION)
  const [deleteRun, { loading: deleting }] = useMutation(DELETE_AGENT_RUN_MUTATION)
  const [corrected, setCorrected] = useState('')
  const [correctMsg, setCorrectMsg] = useState<string | null>(null)

  if (!Number.isFinite(runId)) {
    return <p className="text-sm text-red-700">Invalid run id.</p>
  }
  if (loading) return <p className="text-sm text-[var(--muted)]">Loading run #{runId}…</p>
  if (error) return <p className="text-sm text-red-700">{error.message}</p>

  const run = data?.agentRun
  if (!run) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Run not found.{' '}
        <Link className="text-[var(--accent)] underline" to="/history">
          Back to history
        </Link>
      </p>
    )
  }

  async function onCorrect() {
    setCorrectMsg(null)
    try {
      const res = await correctRun({
        variables: {
          runId: run!.id,
          correctedOutput: corrected || run!.outputText,
        },
      })
      const item = (res.data as { correctRun?: { id: number; source: string } })?.correctRun
      setCorrectMsg(
        item
          ? `Added golden_set id=${item.id} (source=${item.source}).`
          : 'Correction saved.',
      )
    } catch (err) {
      setCorrectMsg(err instanceof Error ? err.message : String(err))
    }
  }

  async function onDelete() {
    if (!window.confirm(`Delete run #${run!.id}? This also removes linked eval scores.`)) {
      return
    }
    await deleteRun({ variables: { id: run!.id } })
    navigate('/history')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to="/history" className="text-sm text-[var(--accent)] underline">
            ← History
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">
            Run #{run.id} · {run.recipeId}
          </h1>
          <p className="text-xs text-[var(--muted)]">
            {new Date(run.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete run'}
        </button>
      </div>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Input
        </h2>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm">
          {run.inputText}
        </pre>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          Output
        </h2>
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words text-sm">
          {run.outputText}
        </pre>
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 className="mb-3 text-lg font-semibold">Execution trace</h2>
        <TraceView steps={run.steps} />
      </section>

      <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <h2 className="mb-2 text-lg font-semibold">Correction loop</h2>
        <textarea
          className="mb-2 min-h-24 w-full rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm"
          placeholder="Paste corrected output…"
          value={corrected || run.outputText}
          onChange={(e) => setCorrected(e.target.value)}
        />
        <button
          type="button"
          onClick={onCorrect}
          disabled={correcting}
          className="rounded-md border border-[var(--accent)] px-3 py-1.5 text-sm text-[var(--accent)] disabled:opacity-50"
        >
          {correcting ? 'Saving…' : 'Add to golden set'}
        </button>
        {correctMsg && <p className="mt-2 text-sm">{correctMsg}</p>}
      </section>
    </div>
  )
}
