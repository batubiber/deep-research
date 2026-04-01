import { useState, useRef, useLayoutEffect } from 'react'
import { animate, stagger } from 'animejs'
import { PlusCircle, Search, Clock, Trash2, Settings, User, FlaskConical, AlertTriangle, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import type { ResearchSession } from '../types'

interface Props {
  history: ResearchSession[]
  activeId?: string
  onSelect: (session: ResearchSession) => void
  onNew: () => void
  onDelete: (id: string) => void
  isOpen: boolean
  onToggle: () => void
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

// --- Delete confirmation modal ---

function DeleteModal({ query, onConfirm, onCancel }: { query: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-[#161b22] border border-[#E5E7EB] dark:border-[#30363d] rounded-2xl shadow-xl dark:shadow-none p-6 max-w-sm w-full mx-4 animate-message-enter">
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 p-1 rounded-lg text-[#9CA3AF] hover:text-[#6B7280] dark:text-[#484f58] dark:hover:text-[#8b949e] hover:bg-[#F5F5F5] dark:hover:bg-[#21262d] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-[#3d1218] flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-red-500 dark:text-[#f85149]" />
        </div>

        {/* Text */}
        <h3 className="text-base font-semibold text-[#1A1A2E] dark:text-[#e6edf3] mb-1">
          Delete research?
        </h3>
        <p className="text-sm text-[#6B7280] dark:text-[#8b949e] mb-1">
          This action cannot be undone.
        </p>
        <p className="text-xs text-[#9CA3AF] dark:text-[#484f58] line-clamp-2 mb-5">
          "{query}"
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#30363d] text-sm font-medium text-[#374151] dark:text-[#c9d1d9] bg-white dark:bg-[#0d1117] hover:bg-[#F5F5F5] dark:hover:bg-[#21262d] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 dark:bg-[#da3633] dark:hover:bg-[#f85149] transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ history, activeId, onSelect, onNew, onDelete, isOpen, onToggle }: Props) {
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
        className={`flex-shrink-0 border-r border-[#E5E7EB] dark:border-[#30363d] bg-white dark:bg-[#0d1117] flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'w-64' : 'w-14'
        }`}
      >
        {/* Collapsed icon strip */}
        {!isOpen && (
          <div className="w-14 flex flex-col items-center flex-1 py-3 gap-1">
            <div className="p-2.5 mb-1">
              <FlaskConical className="w-5 h-5 text-[#4A6CF7]" />
            </div>
            <button
              onClick={onToggle}
              className="p-2.5 rounded-xl hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#6B7280] dark:text-[#8b949e] transition-colors"
              title="Open sidebar"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={onNew}
              className="p-2.5 rounded-xl bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white transition-colors shadow-sm"
              title="New Research"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
            <div className="flex-1" />

            <div className="w-6 border-t border-[#E5E7EB] dark:border-[#30363d]" />

            <button className="p-2.5 rounded-xl hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#6B7280] dark:text-[#8b949e] transition-colors mt-1" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-[#4A6CF7] flex items-center justify-center" title="Profile">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        )}

        {/* Full sidebar content */}
        {isOpen && (
        <div className="w-64 flex flex-col flex-1 overflow-hidden">
        {/* Branding */}
        <div className="px-4 pt-5 pb-3">
          <div data-anim="brand" className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <FlaskConical className="w-6 h-6 text-[#4A6CF7]" />
              <span className="text-base font-bold text-[#1A1A2E] dark:text-[#e6edf3] tracking-wide">
                DeepResearch
              </span>
            </div>
            <button
              onClick={onToggle}
              className="p-2.5 rounded-xl bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white transition-colors"
              title="Close sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* New Research */}
        <div data-anim="actions" className="px-4 pb-3">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[#4A6CF7] hover:bg-[#3B5DE7] text-white text-sm font-medium transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            New Research
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF] dark:text-[#484f58]" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className={`w-full bg-[#F5F5F5] dark:bg-[#161b22] border border-[#E5E7EB] dark:border-[#30363d] rounded-xl pl-8 ${searchQuery ? 'pr-7' : 'pr-3'} py-2 text-xs text-[#1A1A2E] dark:text-[#e6edf3] placeholder-[#9CA3AF] dark:placeholder-[#484f58] focus:outline-none focus:border-[#4A6CF7] dark:focus:border-[#388bfd] transition-colors`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#9CA3AF] hover:text-[#6B7280] dark:text-[#484f58] dark:hover:text-[#8b949e]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Section header */}
        <div className="px-5 pt-2 pb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-[#6B7280] dark:text-[#8b949e]">
            {searchQuery ? `Results (${filtered.length})` : 'Your conversations'}
          </span>
        </div>

        {/* History list */}
        <div className="flex-1 overflow-y-auto px-3 pb-2">
          {filtered.length === 0 ? (
            <p className="text-[#9CA3AF] dark:text-[#484f58] text-xs text-center py-8 px-3">
              {searchQuery ? 'No matching conversations' : 'Past research sessions will appear here'}
            </p>
          ) : (
            Array.from(grouped.entries()).map(([group, sessions]) => (
              <div key={group} className="mb-2">
                <div className="flex items-center gap-1.5 px-2 pt-3 pb-1.5">
                  <Clock className="w-3 h-3 text-[#9CA3AF] dark:text-[#484f58]" />
                  <span className="text-[10px] text-[#9CA3AF] dark:text-[#484f58] uppercase tracking-wider font-semibold">
                    {group}
                  </span>
                </div>
                {sessions.map(session => (
                  <div
                    key={session.id}
                    data-anim="history-item"
                    className={`relative rounded-xl mb-1 group transition-colors ${
                      session.id === activeId
                        ? 'bg-[#4A6CF7]/10 dark:bg-[#1f6feb]/15 border border-[#4A6CF7]/20 dark:border-[#388bfd]/30'
                        : 'hover:bg-[#F5F5F5] dark:hover:bg-[#161b22] border border-transparent'
                    }`}
                  >
                    <button
                      onClick={() => onSelect(session)}
                      className="w-full text-left px-3 py-2.5 pr-8"
                    >
                      <p className={`text-xs font-medium line-clamp-2 leading-snug ${
                        session.id === activeId
                          ? 'text-[#4A6CF7] dark:text-[#79c0ff]'
                          : 'text-[#1A1A2E] dark:text-[#c9d1d9] group-hover:text-[#1A1A2E] dark:group-hover:text-[#e6edf3]'
                      }`}>
                        {session.query}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF] dark:text-[#484f58] mt-1">
                        {formatDate(session.timestamp)}
                      </p>
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setDeleteTarget({ id: session.id, query: session.query })
                      }}
                      className="absolute top-2.5 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-[#3d1218] text-[#9CA3AF] hover:text-red-500 dark:text-[#484f58] dark:hover:text-[#f85149] transition-all"
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
        <div className="px-4 py-3 border-t border-[#E5E7EB] dark:border-[#30363d] flex items-center gap-2">
          <button className="p-2 rounded-xl hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#6B7280] dark:text-[#8b949e] transition-colors">
            <Settings className="w-5 h-5" />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-[#4A6CF7] flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
        </div>
        )}
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
