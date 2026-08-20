import { NavLink, Route, Routes } from 'react-router-dom'
import { RunPage } from './pages/RunPage'
import { HistoryPage } from './pages/HistoryPage'
import { RunDetailPage } from './pages/RunDetailPage'
import { EvalsPage } from './pages/EvalsPage'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm ${
    isActive
      ? 'bg-[var(--brand)] text-white'
      : 'text-[var(--ink)] hover:bg-[var(--brand-soft)]'
  }`

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--panel)]">
        <div className="flex items-center justify-between gap-4 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src="/ZipFavicon.png"
              alt="Zip"
              className="h-8 w-8 shrink-0 rounded-md"
            />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
                Zip-inspired demo
              </div>
              <div className="truncate text-base font-semibold text-[var(--ink)]">
                Procurement Agent Platform
              </div>
            </div>
          </div>
          <nav className="flex shrink-0 gap-1 rounded-lg border border-[var(--line)] bg-[var(--bg)] p-1">
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
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<RunPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/history/:id" element={<RunDetailPage />} />
          <Route path="/evals" element={<EvalsPage />} />
        </Routes>
      </main>
    </div>
  )
}
