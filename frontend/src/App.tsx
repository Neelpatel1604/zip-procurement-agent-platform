import { NavLink, Route, Routes } from 'react-router-dom'
import { RunPage } from './pages/RunPage'
import { HistoryPage } from './pages/HistoryPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { EvalsPage } from './pages/EvalsPage'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm ${
    isActive
      ? 'bg-[var(--accent)] text-white'
      : 'text-[var(--ink)] hover:bg-[var(--accent-soft)]'
  }`

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Zip-inspired demo
          </div>
          <div className="text-xl font-semibold">Procurement Agent Platform</div>
        </div>
        <nav className="flex gap-1 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1">
          <NavLink to="/" end className={linkClass}>
            Run
          </NavLink>
          <NavLink to="/history" className={linkClass}>
            History
          </NavLink>
          <NavLink to="/evals" className={linkClass}>
            Evals
          </NavLink>
        </nav>
      </div>

      <Routes>
        <Route path="/" element={<RunPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/history/:id" element={<RunDetailPage />} />
        <Route path="/evals" element={<EvalsPage />} />
      </Routes>
    </div>
  )
}
