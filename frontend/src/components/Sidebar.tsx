import { useState, useRef, useLayoutEffect } from 'react'
import { animate, stagger } from 'animejs'
import { PlusCircle, Search, Clock, Trash2, Sparkles, User, FlaskConical, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ResearchSession } from '../types'

interface Props {
  history: ResearchSession[]
  activeId?: string
  onSelect: (session: ResearchSession) => void
  onNew: () => void
  onDelete: (id: string) => void
  isOpen: boolean
  onToggle: () => void
  showShader: boolean
  onToggleShader: () => void
}

function getTimeGroup(ts: number): string {
  const now = new Date()
  const d = new Date(ts)
  const diffDays = Math.floor((now.getTime() - ts) / 86400000)
  if (diffDays === 0 && d.getDate() === now.getDate()) return 'Today'
  if (diffDays <= 1) return 'Yesterday'
  if (diffDays < 7) return 'Last 7 Days'
  return 'Older'
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - ts) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function groupByTime(sessions: ResearchSession[]): Map<string, ResearchSession[]> {
  const groups = new Map<string, ResearchSession[]>()
  for (const s of sessions) {
    const group = getTimeGroup(s.timestamp)
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group)!.push(s)
  }
  return groups
}

// --- Delete confirmation modal (Glassmorphic) ---

function DeleteModal({ query, onConfirm, onCancel }: { query: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-md" onClick={onCancel} />

      {/* Dialog — glass panel */}
      <div className="relative glass-strong p-6 max-w-sm w-full mx-4 animate-message-enter">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 neu-btn p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>

        {/* Text */}
        <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">
          Delete research?
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-1">
          This action cannot be undone.
        </p>
        <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-2 mb-5">
          "{query}"
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 neu-btn text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-neu-sm text-sm font-medium text-white bg-gradient-to-r from-red-500 to-red-600 shadow-[0_4px_15px_rgba(239,68,68,0.3)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.4)] transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ history, activeId, onSelect, onNew, onDelete, isOpen, onToggle, showShader, onToggleShader }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; query: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const sidebarRef = useRef<HTMLDivElement>(null)
  const animatedOnce = useRef(false)

  const filtered = searchQuery.trim()
    ? history.filter(s => s.query.toLowerCase().includes(searchQuery.toLowerCase()))
    : history
  const grouped = groupByTime(filtered)

  // Sidebar entrance animation (once)
  useLayoutEffect(() => {
    const el = sidebarRef.current
    if (!el || animatedOnce.current) return
    animatedOnce.current = true

    const brand = el.querySelector('[data-anim="brand"]') as HTMLElement
    const actions = el.querySelector('[data-anim="actions"]') as HTMLElement
    const items = el.querySelectorAll('[data-anim="history-item"]')

    if (brand) {
      brand.style.opacity = '0'
      brand.style.transform = 'translateX(-16px)'
      animate(brand, { opacity: [0, 1], translateX: [-16, 0], duration: 500, ease: 'outExpo' })
    }
    if (actions) {
      actions.style.opacity = '0'
      actions.style.transform = 'translateY(-8px)'
      animate(actions, { opacity: [0, 1], translateY: [-8, 0], duration: 400, ease: 'outExpo', delay: 150 })
    }
    if (items.length) {
      items.forEach(i => { (i as HTMLElement).style.opacity = '0' })
      animate(items, {
        opacity: [0, 1],
        translateX: [-12, 0],
        duration: 350,
        ease: 'outExpo',
        delay: stagger(50, { start: 300 }),
      })
    }
  }, [history.length])

  return (
    <>
      <div
        ref={sidebarRef}
        className={`flex-shrink-0 flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'w-[272px]' : 'w-16'
        }`}
      >
        {/* Sidebar panel */}
        <div className="m-2 flex-1 flex flex-col overflow-hidden rounded-2xl bg-white/5 border border-white/10">
          {/* Collapsed icon strip */}
          {!isOpen && (
            <div className="flex flex-col items-center flex-1 py-4 gap-2">
              <div className="p-2.5 mb-1">
                <FlaskConical className="w-5 h-5 text-indigo-400" />
              </div>
              <button
                onClick={onToggle}
                className="p-2.5 rounded-lg bg-white/10 border border-white/10 text-gray-400 hover:text-white hover:bg-white/15 transition-all"
                title="Open sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onNew}
                className="p-2.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 transition-all"
                title="New Research"
              >
                <PlusCircle className="w-4 h-4" />
              </button>
              <div className="flex-1" />
              <button
                onClick={onToggleShader}
                className={`p-2.5 rounded-lg border transition-all ${showShader ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-white/10 border-white/10 text-gray-400 hover:text-white hover:bg-white/15'}`}
                title={showShader ? 'Disable background effect' : 'Enable background effect'}
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                <User className="w-4 h-4 text-indigo-400" />
              </div>
            </div>
          )}

          {/* Full sidebar content */}
          {isOpen && (
          <div className="flex flex-col flex-1 overflow-hidden">
          {/* Branding */}
          <div className="px-4 pt-5 pb-3">
            <div data-anim="brand" className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <FlaskConical className="w-5 h-5 text-indigo-400" />
                </div>
                <span className="text-base font-bold text-white tracking-wide">
                  DeepResearch
                </span>
              </div>
              <button
                onClick={onToggle}
                className="p-2 rounded-lg bg-white/10 border border-white/10 text-gray-400 hover:text-white hover:bg-white/15 transition-all"
                title="Close sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* New Research — primary glow button */}
          <div data-anim="actions" className="px-4 pb-3">
            <button
              onClick={onNew}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 text-sm font-medium transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              New Research
            </button>
          </div>

          {/* Search input — neumorphic inset */}
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className={`w-full rounded-xl bg-white/5 border border-white/10 pl-9 ${searchQuery ? 'pr-7' : 'pr-3'} py-2.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-white/20 transition-all`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-500 hover:text-gray-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Section header */}
          <div className="px-5 pt-2 pb-1 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
              {searchQuery ? `Results (${filtered.length})` : 'Conversations'}
            </span>
          </div>

          {/* History list */}
          <div className="flex-1 overflow-y-auto px-3 pb-2">
            {filtered.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-8 px-3">
                {searchQuery ? 'No matching conversations' : 'Past research sessions will appear here'}
              </p>
            ) : (
              Array.from(grouped.entries()).map(([group, sessions]) => (
                <div key={group} className="mb-2">
                  <div className="flex items-center gap-1.5 px-2 pt-3 pb-1.5">
                    <Clock className="w-3 h-3 text-gray-500" />
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                      {group}
                    </span>
                  </div>
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      data-anim="history-item"
                      className={`relative rounded-xl mb-1.5 group transition-all duration-200 ${
                        session.id === activeId
                          ? 'bg-white/10 border border-white/15'
                          : 'hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <button
                        onClick={() => onSelect(session)}
                        className="w-full text-left px-3 py-2.5 pr-8"
                      >
                        <p className={`text-xs font-medium line-clamp-2 leading-snug ${
                          session.id === activeId
                            ? 'text-indigo-400'
                            : 'text-gray-300 group-hover:text-white'
                        }`}>
                          {session.query}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {formatDate(session.timestamp)}
                        </p>
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          setDeleteTarget({ id: session.id, query: session.query })
                        }}
                        className="absolute top-2.5 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-500 transition-all"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Bottom section */}
          <div className="px-3 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleShader}
                className={`p-2.5 rounded-lg border transition-all ${showShader ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400' : 'bg-white/10 border-white/10 text-gray-400 hover:text-white hover:bg-white/15'}`}
                title={showShader ? 'Disable background effect' : 'Enable background effect'}
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <div className="ml-auto flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
              </div>
            </div>
            <div className="px-1 text-[10px] text-gray-600">
              DeepResearch v0.1.0
            </div>
          </div>
          </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          query={deleteTarget.query}
          onConfirm={() => {
            onDelete(deleteTarget.id)
            setDeleteTarget(null)
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}
