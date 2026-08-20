import { useEffect, useId, useRef, useState } from 'react'
import type { Recipe } from '../types'

type Props = {
  recipes: Recipe[]
  value: string
  disabled?: boolean
  loading?: boolean
  onChange: (recipeId: string) => void
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-[var(--muted)] transition-transform duration-150 ${
        open ? 'rotate-180' : ''
      }`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M5.5 7.5L10 12l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function RecipeSelect({ recipes, value, disabled, loading, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = recipes.find((r) => r.id === value) ?? recipes[0]

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <span className="mb-1.5 block text-sm font-medium text-[var(--ink)]">Recipe</span>
      <button
        type="button"
        disabled={disabled || loading || recipes.length === 0}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white px-3.5 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
          open
            ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/15'
            : 'border-[var(--line)] hover:border-stone-300'
        }`}
      >
        <span className="min-w-0 flex-1">
          {loading || !selected ? (
            <span className="text-sm text-[var(--muted)]">Loading recipes…</span>
          ) : (
            <>
              <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                {selected.name}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                {selected.tools?.length ? selected.tools.join(' · ') : selected.id}
              </span>
            </>
          )}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--bg)]">
          <Chevron open={open} />
        </span>
      </button>

      {open && recipes.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[var(--line)] bg-white py-1.5 shadow-[0_12px_40px_rgba(15,23,42,0.12)]"
        >
          {recipes.map((recipe) => {
            const active = recipe.id === (selected?.id ?? value)
            return (
              <li key={recipe.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full cursor-pointer items-start gap-3 px-3.5 py-3 text-left transition ${
                    active ? 'bg-[var(--brand-soft)]' : 'hover:bg-[var(--bg)]'
                  }`}
                  onClick={() => {
                    onChange(recipe.id)
                    setOpen(false)
                  }}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? 'border-[var(--brand)] bg-[var(--brand)]'
                        : 'border-stone-300 bg-white'
                    }`}
                    aria-hidden
                  >
                    {active && (
                      <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 6.2L4.8 8.5L9.5 3.5"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-semibold ${
                        active ? 'text-[var(--brand)]' : 'text-[var(--ink)]'
                      }`}
                    >
                      {recipe.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {recipe.id}
                      {recipe.tools?.length ? ` · ${recipe.tools.join(', ')}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
